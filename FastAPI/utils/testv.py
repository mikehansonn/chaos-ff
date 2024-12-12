import asyncio
import sys
import requests
from bs4 import BeautifulSoup
import json
from db import get_database
from FastAPI.services.fake_player import FakeNFLPlayer
from datetime import datetime, time, timezone
from typing import Dict, List, Tuple

def get_nfl_team_abbr(team_name):
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

def calculate_nfl_weeks() -> Tuple[int, int]:
    season_start = datetime(2024, 9, 5, tzinfo=timezone.utc)
    current_time = datetime.now(timezone.utc)
    days_since_start = (current_time - season_start).days
    current_week = (days_since_start // 7) + 1
    
    transition_time = datetime.combine(
        current_time.date(),
        time(7, 0),
        tzinfo=timezone.utc
    )
    
    current_weekday = current_time.weekday()
    
    if current_weekday >= 1 and current_time >= transition_time:
        current_week += 1
    
    projection_week = current_week
    current_week = max(1, min(18, current_week))
    projection_week = max(1, min(18, projection_week))
    
    return current_week, projection_week

def get_week() -> int:
    current_week, _ = calculate_nfl_weeks()
    return current_week

def get_proj_week() -> int:
    _, projection_week = calculate_nfl_weeks()
    return projection_week

def scrape_proj_data(week: int, total_pages: int, points_intex: int, players: List[Dict], player_type: str):
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
                elif player_rows == '8':
                    team = get_nfl_team_abbr(cols[1].find('a').text.strip())
                else:
                    team = cols[0].find('em').text.strip().split(" - ")[1]

                new_player = {
                    'name': cols[0].find('a').text.strip(),
                    'team': team,
                    'position': cols[0].find('em').text.strip().split(" - ")[0],
                    'opponent': cols[1].text.strip(),
                    'projected_points': cols[points_intex].text.strip(),
                    'injury_status': injury,
                }

                players.append(new_player)
        else:
            print(f"Failed to fetch data. Status code: {response.status_code}")
        num += 25


def scrape_week_data(week: int, total_pages: int, points_index: int, players: List[Dict], player_type: str):
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

                '''
                new_player = {
                    'name': cols[1].find('a').text.strip(),
                    'position': cols[1].find('em').text.strip().split(" - ")[0],
                    'team': cols[1].find('em').text.strip().split(" - ")[1],
                    'injury_status': injury,
                    'opponent': cols[2].text.strip(),
                    'pass_yards': cols[3].text.strip(),
                    'pass_td': cols[4].text.strip(),
                    'pass_int': cols[5].text.strip(),
                    'rushing_yards': cols[6].text.strip(),
                    'rushing_tds': cols[7].text.strip(),
                    'receptions': cols[8].text.strip(),
                    'rec_yards': cols[9].text.strip(),
                    'rec_td': cols[10].text.strip(),
                    'ret_td': cols[11].text.strip(),
                    'fumble_td': cols[12].text.strip(),
                    'two_point': cols[13].text.strip(),
                    'fumbles': cols[14].text.strip(),
                    'total_points': cols[15].text.strip(),
                }
                '''
                new_player = {
                    'name': cols[1].find('a').text.strip(),
                    'injury_status': injury,
                    'week_points': cols[points_index].text.strip(),
                }
                
                players.append(new_player)
        else:
            print(f"Failed to fetch data. Status code: {response.status_code}")
        num += 25

def load_nfl_players():
    file_path = 'proj_players.json'
    try:
        with open(file_path, 'r') as file:
            players_data = json.load(file)
        
        players = []
        for player_data in players_data:
            # Create new NFLPlayer instance
            player = FakeNFLPlayer(
                name=player_data['name'],
                position=player_data['position'],
                team=player_data['team']
            )
            
            # Set basic properties
            player.projected_points = player_data.get('projected_points', 0.0)
            player.total_points = player_data.get('total_points', 0.0)
            player.opponent = player_data.get('opponent', '')
            player.injury_status = player_data.get('injury_status')
            
            # Set season stats
            stats_data = player_data.get('stats', {})
            for stat_name, value in stats_data.items():
                setattr(player.stats, stat_name, value)
            
            # Set weekly stats
            player.weeks = player_data.get('weeks', [])
            players.append(player.to_dict())
        
        return players
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        return []
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in file {file_path}")
        return []
    except KeyError as e:
        print(f"Error: Missing required field in JSON data: {e}")
        return []

def process_player_data(players, proj_data, week_data, week):
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
        # week = get_week()
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

async def write_individual_player(player):
    db = get_database()
    
    player_object = await db.nflplayers.find_one({"name": player["name"]})
    
    if player_object:
        await db.nflplayers.update_one(
            {"_id": player_object["_id"]},
            {
                "$set": {
                    "weeks": player["weeks"],
                    "projected_points": player["projected_points"],
                    "total_points": player["total_points"],
                    "opponent": player["opponent"],   
                    "injury_status": player["injury_status"]
                }
            })
    else:
        await db.nflplayers.insert_one(player)

async def main():
    players = load_nfl_players()
    proj_data = []
    week_data = []
    week = get_week()

    if '-w' in sys.argv or '-all' in sys.argv:
        # Offense - week, 41, 15, week_data, 'O'
        scrape_week_data(week, 41, 15, week_data, 'O')
        # Kicker - week, 3, 9, week_data, 'K'
        scrape_week_data(week, 3, 9, week_data, 'K')
        # Defense - week, 2, 11, week_data, '8'
        scrape_week_data(week, 2, 11, week_data, '8')

    if '-p' in sys.argv or '-all' in sys.argv:
        # Offense - week, 41, 15, week_data, 'O'
        scrape_proj_data(week, 41, 14, proj_data, 'O')
        # Kicker - week, 3, 9, week_data, 'K'
        scrape_proj_data(week, 3, 8, proj_data, 'K')
        # Defense - week, 2, 11, week_data, '8'
        scrape_proj_data(week, 2, 10, proj_data, '8')

    process_player_data(players, proj_data, week_data, week)
    players.sort(key=lambda x: x['projected_points'], reverse=True)

    db = get_database()

    # Update database and save to file
    for player in players:
        await write_individual_player(player)

    await db.nflplayers.create_index([("projected_points", -1)])
    
    sorted_players = await db.nflplayers.find().sort("projected_points", -1).to_list(length=None)
    
    if sorted_players:
        await db.nflplayers.delete_many({})
        await db.nflplayers.insert_many(sorted_players)

    filename = "proj_players.json"
    with open(filename, 'w') as json_file:
        json.dump(players, json_file, indent=4)
    
if __name__ == "__main__":
    asyncio.run(main())
    