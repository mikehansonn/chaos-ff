from datetime import datetime, time, timezone
import asyncio
from utils.db import get_database
from models.base import PyObjectId

class MatchupManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.matchup_check_task = None
            self.db = None
            self.initialized = True
    
    async def initialize(self):
        """Initialize the matchup manager and start background task"""
        self.db = get_database()
        self.matchup_check_task = asyncio.create_task(self._check_matchup_activation())
        print("Matchup manager initialized")

    def is_matchup_time(self) -> bool:
        """Check if it's time to activate matchups (Thursday 7:30 PM UTC)"""
        current_time = datetime.now(timezone.utc)

        if current_time.weekday() != 3:
            return False
            
        activation_time = time(19, 30, tzinfo=timezone.utc)
        current_day_activation = datetime.combine(
            current_time.date(),
            activation_time
        )
        
        time_difference = abs((current_time - current_day_activation).total_seconds())
        return time_difference <= 120

    async def _check_matchup_activation(self):
        """Background task to check for matchup activation times"""
        while True:
            try:
                print("Check Matchup Activation")
                if self.is_matchup_time():
                    await self._activate_matchups()
                
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in matchup activation check: {e}")
                await asyncio.sleep(3600) 

    async def _activate_matchups(self):
        """Activate matchups for all leagues"""
        try:
            # Get all leagues
            leagues = await self.db.leagues.find({}).to_list(None)
            
            for league in leagues:
                current_week = league["week"]
                start_week = 18 - len(league["schedule"]) + 1
                if current_week - start_week < 0:
                    continue # this league has not started yet
                matchups = league["schedule"][current_week - start_week]

                for matchup_id in matchups:
                    matchup = await self.db.matchups.find_one({"_id": PyObjectId(matchup_id)})
                    if matchup:
                        team_a = await self.db.teams.find_one({"_id": PyObjectId(matchup["team_a"])})
                        if not team_a:
                            team_a = {"roster": [PyObjectId() for _ in range(17)]}
                        team_b = await self.db.teams.find_one({"_id": PyObjectId(matchup["team_b"])})
                        if not team_b:
                            team_b = {"roster": [PyObjectId() for _ in range(17)]}
                        await self.db.matchups.update_one(
                            {"_id": PyObjectId(matchup_id)},
                            {"$set": {
                                "status": "started",
                                "team_a_roster": team_a["roster"],
                                "team_b_roster": team_b["roster"]
                            }}
                        )
            print(f"Activated matchups for {len(leagues)} leagues")
            
        except Exception as e:
            print(f"Error activating matchups: {e}")

    async def complete_active_matchups(self):
        """Complete all currently active matchups"""
        try:
            matchups = await self.db.matchups.find({"status": "started"}).to_list(None)

            for matchup in matchups:
                print(matchup)
                active_a = matchup['team_a_roster'][:9]
                active_b = matchup['team_b_roster'][:9]
                a_total = 0
                b_total = 0
                week = matchup['week']

                for i in range(len(active_a)):
                    playa = await self.db.nflplayers.find_one({"_id": PyObjectId(active_a[i])})
                    if playa:
                        a_total += playa['weeks'][week - 1]

                    playb = await self.db.nflplayers.find_one({"_id": PyObjectId(active_b[i])})
                    if playb:
                        b_total += playb['weeks'][week - 1]
                
                winner = 'tie'
                team_a = await self.db.teams.find_one({"_id": PyObjectId(matchup['team_a'])})
                team_b = await self.db.teams.find_one({"_id": PyObjectId(matchup['team_b'])})
                if not team_a or not team_b:
                    await self.db.matchups.update_one(
                    {'_id': PyObjectId(matchup["_id"])},
                        {"$set": {
                            "team_a_score": a_total,
                            "team_b_score": b_total,
                            "status": "completed"
                        }}
                    )
                    return

                if a_total > b_total:
                    winner = matchup['team_a']
                    await self.db.teams.update_one(
                        {'_id': PyObjectId(matchup['team_a'])},
                        {"$inc": {
                            "wins": 1,
                            "total_points": a_total
                        }}
                    )

                    await self.db.teams.update_one(
                        {'_id': PyObjectId(matchup['team_b'])},
                        {"$inc": {
                            "losses": 1,
                            "total_points": b_total
                        }}
                    )
                elif a_total < b_total:
                    winner = matchup['team_b']
                    await self.db.teams.update_one(
                        {'_id': PyObjectId(matchup['team_a'])},
                        {"$inc": {
                            "losses": 1,
                            "total_points": a_total
                        }}
                    )

                    await self.db.teams.update_one(
                        {'_id': PyObjectId(matchup['team_b'])},
                        {"$inc": {
                            "wins": 1,
                            "total_points": b_total
                        }}
                    )
                
                await self.db.matchups.update_one(
                    {'_id': PyObjectId(matchup["_id"])},
                    {"$set": {
                        "team_a_score": a_total,
                        "team_b_score": b_total,
                        "status": "completed",
                        "winner": winner
                    }}
                )
        except Exception as e:
            print(f"Error completing matchups: {e}")

    def cleanup(self):
        """Cancel the background task"""
        if self.matchup_check_task:
            self.matchup_check_task.cancel()