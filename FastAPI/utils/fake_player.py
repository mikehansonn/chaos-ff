from typing import List, Optional

class FakeNFLPlayerStats():
    passing_yards: int = 0
    passing_touchdowns: int = 0
    rushing_yards: int = 0
    rushing_touchdowns: int = 0
    receptions: int = 0
    receiving_yards: int = 0
    receiving_touchdowns: int = 0

    def to_dict(self):
        return {
            "passing_yards": self.passing_yards,
            "passing_touchdowns": self.passing_touchdowns,
            "rushing_yards": self.rushing_yards,
            "rushing_touchdowns": self.rushing_touchdowns,
            "receptions": self.receptions,
            "receiving_yards": self.receiving_yards,
            "receiving_touchdowns": self.receiving_touchdowns
        }

class FakeNFLPlayer():
    def __init__(self, name, position, team):
        self.name: str = name
        self.position: str = position
        self.team: str = team
        self.stats: FakeNFLPlayerStats = FakeNFLPlayerStats()
        self.weeks: List[FakeNFLPlayerStats] = [0] * 18
        self.projected_points: float = 0.0
        self.total_points: float = 0.0
        self.opponent: str = ""
        self.injury_status: Optional[str] = None

    def to_dict(self):
        return {
            "name": self.name,
            "position": self.position,
            "team": self.team,
            "stats": self.stats.to_dict(),  # Call the to_dict method for stats
            "weeks": self.weeks,  # Convert each week's stats to dict
            "projected_points": self.projected_points,
            "total_points": self.total_points,
            "opponent": self.opponent,
            "injury_status": self.injury_status
        }
