import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime, time, timezone
from typing import Dict, List, Tuple
from services.fake_player import FakeNFLPlayer
from models import PyObjectId
from pymongo import MongoClient
import os
from dotenv import load_dotenv

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, PyObjectId):
            return str(o)
        return super().default(o)

class DataScrapeManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            load_dotenv()
            mongo_url = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
            self.client = MongoClient(mongo_url)
            db_name = os.getenv('MONGODB_DB_NAME', 'fantasy_football')
            self.db = self.client[db_name]
            self.initialized = True

    def run_full_scrape(self):
        """Run a complete scrape of projection and week data"""
        try:
            week = self.get_week()
            
            # Scrape data
            proj_data = []
            week_data = []

            # Scrape projection data
            self.scrape_proj_data(week, 41, 14, proj_data, 'O')
            self.scrape_proj_data(week, 3, 8, proj_data, 'K')
            self.scrape_proj_data(week, 2, 10, proj_data, '8')

            # Scrape week data
            self.scrape_week_data(week, 41, 15, week_data, 'O')
            self.scrape_week_data(week, 3, 9, week_data, 'K')
            self.scrape_week_data(week, 2, 11, week_data, '8')

            # Load existing players
            players = self.load_nfl_players()

            # Process and update player data
            updated_players = self.process_player_data(players, proj_data, week_data, week)
            
            # Sort players by projected points
            updated_players.sort(key=lambda x: float(x['projected_points'] or 0), reverse=True)

            # Update database and save to file
            for player in updated_players:
                success = self.write_individual_player(player)
                if not success:
                    print(f"Failed to update player in database: {player['name']}")

            # Save to JSON file with custom encoder
            filename = "proj_players.json"
            with open(filename, 'w') as json_file:
                json.dump(updated_players, json_file, indent=4, cls=JSONEncoder)

            print(f"Completed data scrape for week {week}")
            
            # Clean the result for Celery serialization
            clean_players = []
            for player in updated_players:
                clean_player = player.copy()
                if '_id' in clean_player:
                    del clean_player['_id']
                clean_players.append(clean_player)
                
            return clean_players

        except Exception as e:
            print(f"Error in run_full_scrape: {e}")
            raise

    # The following methods would be direct copies from the original data_scrape.py:
    def get_nfl_team_abbr(self, team_name):
        # Existing implementation from data_scrape.py
        nfl_teams = {
            "Buffalo Bills": "BUF",
            "Miami Dolphins": "MIA", 
            "New England Patriots": "NE",
            "New York Jets": "NYJ",
            "Baltimore Ravens": "BAL",
            "Cincinnati Bengals": "CIN",
            "Cleveland Browns": "CLE", 
            "Pittsburgh Steelers": "PIT",
            "Houston Texans": "HOU",
            "Indianapolis Colts": "IND",
            "Jacksonville Jaguars": "JAX",
            "Tennessee Titans": "TEN",
            "Denver Broncos": "DEN",
            "Kansas City Chiefs": "KC",
            "Las Vegas Raiders": "LV",
            "Los Angeles Chargers": "LAC",
            "Dallas Cowboys": "DAL",
            "New York Giants": "NYG",
            "Philadelphia Eagles": "PHI",
            "Washington Commanders": "WAS",
            "Chicago Bears": "CHI",
            "Detroit Lions": "DET",
            "Green Bay Packers": "GB", 
            "Minnesota Vikings": "MIN",
            "Atlanta Falcons": "ATL",
            "Carolina Panthers": "CAR",
            "New Orleans Saints": "NO",
            "Tampa Bay Buccaneers": "TB",
            "Arizona Cardinals": "ARI",
            "Los Angeles Rams": "LAR",
            "San Francisco 49Ers": "SF",
            "Seattle Seahawks": "SEA"
        }
        
        team_name = team_name.strip().title()
        
        if team_name in nfl_teams:
            return nfl_teams[team_name]
        
        raise ValueError(f"No abbreviation found for team: {team_name}")

    def calculate_nfl_weeks(self) -> Tuple[int, int]:
        season_start = datetime.combine(datetime(2024, 9, 4), time(0, 0), tzinfo=timezone.utc)
        current_time = datetime.now(timezone.utc)
        days_since_start = (current_time - season_start).days
        current_week = (days_since_start // 7) + 1

        current_week = max(1, min(18, current_week))

        return current_week, current_week

    def get_week(self) -> int:
        current_week, _ = self.calculate_nfl_weeks()
        return current_week

    def scrape_proj_data(self, week: int, total_pages: int, points_index: int, players: List[Dict], player_type: str):
        num = 1
        headers = {'User-Agent': 'Mozilla/5.0'}

        while num < total_pages * 25:
            url = f"https://fantasy.nfl.com/research/projections?offset={num}&position={player_type}&sort=pts&statCategory=stats&statSeason=2024&statType=weekStats&statWeek={week}"
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                player_rows = soup.select('tr[class^="player-"]')
                for row in player_rows:
                    cols = row.find_all('td')
                    injury = cols[0].find('strong')
                    if injury:
                        injury = injury.text.strip()
                        if injury == "View News":
                            injury = ''
                        else:
                            injury
                    else:
                        injury = ''
                    
                    if len(cols[0].find('em').text.strip().split(" - ")) == 1:
                        team = 'FA'
                    elif player_type == '8':
                        team = self.get_nfl_team_abbr(cols[1].find('a').text.strip())
                    else:
                        team = cols[0].find('em').text.strip().split(" - ")[1]

                    new_player = {
                        'name': cols[0].find('a').text.strip(),
                        'team': team,
                        'position': cols[0].find('em').text.strip().split(" - ")[0],
                        'opponent': cols[1].text.strip(),
                        'projected_points': cols[points_index].text.strip(),
                        'injury_status': injury,
                    }

                    players.append(new_player)
            else:
                print(f"Failed to fetch data. Status code: {response.status_code}")
            num += 25

    def scrape_week_data(self, week: int, total_pages: int, points_index: int, players: List[Dict], player_type: str):
        num = 1
        headers = {'User-Agent': 'Mozilla/5.0'}

        while num < total_pages * 25:
            url = f"https://fantasy.nfl.com/research/scoringleaders?offset={num}&position={player_type}&sort=pts&statCategory=stats&statSeason=2024&statType=weekStats&statWeek={week}"
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                player_rows = soup.select('tr[class^="player-"]')
                for row in player_rows:
                    cols = row.find_all('td')
                    injury = cols[1].find('strong')
                    if injury:
                        injury = injury.text.strip()
                        if injury == "View News":
                            injury = ''
                        else:
                            injury
                    else:
                        injury = ''

                    new_player = {
                        'name': cols[1].find('a').text.strip(),
                        'injury_status': injury,
                        'week_points': cols[points_index].text.strip(),
                    }
                    
                    players.append(new_player)
            else:
                print(f"Failed to fetch data. Status code: {response.status_code}")
            num += 25

    def load_nfl_players(self) -> List[Dict]:
        """Load players with proper error handling"""
        try:
            collection = self.db.nflplayers
            players = list(collection.find())
            
            # Initialize weeks array if it doesn't exist
            for player in players:
                if 'weeks' not in player:
                    player['weeks'] = [0.0] * 18  # NFL season has 18 weeks
                
                # Ensure numeric fields are properly typed
                player['projected_points'] = float(player.get('projected_points', 0) or 0)
                player['total_points'] = float(player.get('total_points', 0) or 0)
                player['weeks'] = [float(week or 0) for week in player['weeks']]
            
            return players
            
        except Exception as e:
            print(f"Error loading players from database: {e}")
            return []

    def process_player_data(self, players, proj_data, week_data, week):
        current_players = players.copy()
        
        # Handle projection data first
        if proj_data:
            for new_player in proj_data:
                found = False
                for player in current_players:
                    if new_player["name"] == player["name"]:
                        player["opponent"] = new_player["opponent"]
                        player["team"] = new_player["team"]
                        player["position"] = new_player["position"]
                        player["projected_points"] = new_player["projected_points"]
                        player["injury_status"] = new_player["injury_status"]
                        found = True
                        break
                if not found:
                    ne_player = FakeNFLPlayer(
                        name=new_player['name'],
                        position=new_player['position'],
                        team=new_player['team']
                    )
                    
                    ne_player.projected_points = new_player['projected_points']
                    ne_player.total_points = 0.0
                    ne_player.opponent = new_player['opponent']
                    current_players.append(ne_player.to_dict())

            # Clean up projection data
            for player in current_players:
                if player['projected_points'] == '-':
                    player['projected_points'] = 0.0
                player['projected_points'] = float(player['projected_points'])
        
        # Handle week data
        if week_data:
            for new_player in week_data:
                for player in current_players:
                    if new_player["name"] == player["name"]:
                        player["injury_status"] = new_player["injury_status"]
                        player["weeks"][week - 1] = new_player["week_points"]
                        total = 0
                        for wee in player["weeks"]:
                            total += float(wee) if wee != '-' else 0.0
                        player["total_points"] = total
                        break

            # Clean up week data
            for player in current_players:
                if player['weeks'][week - 1] == '-':
                    player['weeks'][week - 1] = 0.0
                player['weeks'][week - 1] = float(player['weeks'][week - 1])
        
        return current_players

    def write_individual_player(self, player) -> bool:
        """Synchronous version of database write with error handling"""
        try:
            collection = self.db.nflplayers
            
            # Create a clean copy of the player data
            player_data = player.copy()
            if '_id' in player_data:
                del player_data['_id']
            
            # Ensure numeric fields are properly typed
            player_data['projected_points'] = float(player_data['projected_points'] or 0)
            player_data['total_points'] = float(player_data['total_points'] or 0)
            
            # Clean weeks data
            player_data['weeks'] = [float(week or 0) for week in player_data['weeks']]
            
            # Perform upsert operation
            result = collection.update_one(
                {"name": player_data["name"]},
                {"$set": player_data},
                upsert=True
            )
            
            return result.acknowledged

        except Exception as e:
            print(f"Error writing player {player.get('name', 'unknown')} to database: {e}")
            return False