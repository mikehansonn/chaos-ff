from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
import json
import sys
from db import get_database
from fake_player import FakeNFLPlayer
import asyncio

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

def scrape_all_offense_proj_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_proj_week()
    players = []
    
    while num < 1002:
        url = f"https://fantasy.nfl.com/research/projections#researchProjections=researchProjections%2C%2Fresearch%2Fprojections%253Foffset%253D{num}%2526position%253DO%2526sort%253DprojectedPts%2526statCategory%253DprojectedStats%2526statSeason%253D2024%2526statType%253DweekProjectedStats%2526statWeek%253D{week}%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1)  # Wait up to 5 seconds

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")  # Get cells first
            if cells:  # Make sure there are cells in the row
                cell0_split =  cells[0].text.split("\n")
                split = cell0_split[1].split(" - ")
                injury_status = ""
                if len(cell0_split) >= 3:
                    if cell0_split[2] == 'View News':
                        injury_status = ""
                    else:
                        injury_status = cell0_split[2]
                
                if len(split) == 1:
                    team = 'FA'
                else:
                    team = split[1]
                position = split[0]
                new_player = {
                    "name": cells[0].text.split("\n")[0],  # Add .text to get the actual content
                    "team": team,
                    "position": position,
                    "opponent": cells[1].text,
                    "projected_points": cells[14].text,
                    "injury_status": injury_status
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

def scrape_all_kicker_proj_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_proj_week()
    players = []
    
    while num < 52:
        url = f"https://fantasy.nfl.com/research/projections?offset=1&position=O&sort=projectedPts&statCategory=projectedStats&statSeason=2024&statType=weekProjectedStats&statWeek={week}#researchProjections=researchProjections%2C%2Fresearch%2Fprojections%253Foffset%253D{num}%2526position%253D7%2526sort%253DprojectedPts%2526statCategory%253DprojectedStats%2526statSeason%253D2024%2526statType%253DweekProjectedStats%2526statWeek%253D8%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1)  # Wait up to 5 seconds

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")  # Get cells first
            if cells:  # Make sure there are cells in the row
                cell0_split =  cells[0].text.split("\n")
                split = cell0_split[1].split(" - ")
                injury_status = ""
                if len(cell0_split) >= 3:
                    if cell0_split[2] == 'View News':
                        injury_status = ""
                    else:
                        injury_status = cell0_split[2]
                
                if len(split) == 1:
                    team = 'FA'
                else:
                    team = split[1]
                position = split[0]
                new_player = {
                    "name": cells[0].text.split("\n")[0],  # Add .text to get the actual content
                    "team": team,
                    "position": position,
                    "opponent": cells[1].text,
                    "projected_points": cells[8].text,
                    "injury_status": injury_status
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

def scrape_all_defense_proj_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_proj_week()
    players = []
    
    while num < 27:
        url = f"https://fantasy.nfl.com/research/projections?position=8&statCategory=projectedStats&statSeason=2024&statType=weekProjectedStats&statWeek={week}#researchProjections=researchProjections%2C%2Fresearch%2Fprojections%253Foffset%253D{num}%2526position%253D8%2526sort%253DprojectedPts%2526statCategory%253DprojectedStats%2526statSeason%253D2024%2526statType%253DweekProjectedStats%2526statWeek%253D8%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1)  # Wait up to 5 seconds

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")  # Get cells first
            if cells:  # Make sure there are cells in the row
                cell0_split =  cells[0].text.split("\n")
                team = get_nfl_team_abbr(cell0_split[0])
                
                new_player = {
                    "name": cells[0].text.split("\n")[0],  # Add .text to get the actual content
                    "team": team,
                    "position": "DEF",
                    "opponent": cells[1].text,
                    "projected_points": cells[10].text,
                    "injury_status": ""
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

def scrape_all_offense_week_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_week()
    players = []
    
    while num < 1002:
        url = f"https://fantasy.nfl.com/research/scoringleaders#researchScoringLeaders=researchScoringLeaders%2C%2Fresearch%2Fscoringleaders%253Foffset%253D{num}%2526position%253DO%2526sort%253Dpts%2526statCategory%253Dstats%2526statSeason%253D2024%2526statType%253DweekStats%2526statWeek%253D{week}%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1) 

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if cells: 
                new_player = {
                    "name": cells[1].text.split("\n")[0],  # Add .text to get the actual content
                    "week_points": cells[15].text
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

def scrape_all_kicker_week_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_week()
    players = []
    
    while num < 52:
        url = f"https://fantasy.nfl.com/research/scoringleaders#researchScoringLeaders=researchScoringLeaders%2C%2Fresearch%2Fscoringleaders%253Foffset%253D{num}%2526position%253D7%2526sort%253Dpts%2526statCategory%253Dstats%2526statSeason%253D2024%2526statType%253DweekStats%2526statWeek%253D{week}%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1) 

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if cells: 
                new_player = {
                    "name": cells[1].text.split("\n")[0],  # Add .text to get the actual content
                    "week_points": cells[9].text
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

def scrape_all_defense_week_data():
    service = Service(r'C:\Individual_Projects\fantasy-football\FastAPI\services\chromedriver-win64\chromedriver.exe')
    driver = webdriver.Chrome(service=service)
    
    num = 1 
    week = get_week()
    players = []
    
    while num < 27:
        url = f"https://fantasy.nfl.com/research/scoringleaders#researchScoringLeaders=researchScoringLeaders%2C%2Fresearch%2Fscoringleaders%253Foffset%253D{num}%2526position%253D8%2526sort%253Dpts%2526statCategory%253Dstats%2526statSeason%253D2024%2526statType%253DweekStats%2526statWeek%253D{week}%2Creplace"
        driver.get(url)

        driver.implicitly_wait(1) 

        rows = driver.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if cells: 
                new_player = {
                    "name": cells[1].text.split("\n")[0],  # Add .text to get the actual content
                    "week_points": cells[11].text
                }
                players.append(new_player)

        num += 25

    driver.quit()
    return players

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

def process_player_data(players, proj_data, week_data):
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
        week = get_week()
        for new_player in week_data:
            for player in current_players:
                if new_player["name"] == player["name"]:
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

def get_week():
    week = 8
    return week

def get_proj_week():
    week = 9
    return week

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
    
    # Collect projection data
    if '-o' in sys.argv:
        proj_data.extend(scrape_all_offense_proj_data())
    if '-k' in sys.argv:
        proj_data.extend(scrape_all_kicker_proj_data())
    if '-d' in sys.argv:
        proj_data.extend(scrape_all_defense_proj_data())
    if '-A' in sys.argv:
        proj_data.extend(scrape_all_offense_proj_data())
        proj_data.extend(scrape_all_kicker_proj_data())
        proj_data.extend(scrape_all_defense_proj_data())

    # Collect week data
    if '-wo' in sys.argv:
        week_data.extend(scrape_all_offense_week_data())
    if '-wk' in sys.argv:
        week_data.extend(scrape_all_kicker_week_data())
    if '-wd' in sys.argv:
        week_data.extend(scrape_all_defense_week_data())
    if '-W' in sys.argv:
        week_data.extend(scrape_all_offense_week_data())
        week_data.extend(scrape_all_kicker_week_data())
        week_data.extend(scrape_all_defense_week_data())
    
    # Process both types of data in a single pass
    current_players = process_player_data(players, proj_data, week_data)
    current_players.sort(key=lambda x: x['projected_points'], reverse=True)

    # Update database and save to file
    for cp in current_players:
        await write_individual_player(cp)

    filename = "proj_players.json"
    with open(filename, 'w') as json_file:
        json.dump(current_players, json_file, indent=4)

if __name__ == "__main__":
    asyncio.run(main())