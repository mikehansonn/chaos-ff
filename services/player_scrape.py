import requests
from bs4 import BeautifulSoup
from FastAPI.services.fake_player import NFLPlayer
import json
import string

# Base URLs for each sport
base_urls = {
    "NFL": "https://www.covers.com/sport/football/nfl/players/"
    #"NHL": "https://www.covers.com/sport/hockey/nhl/players/",
    #"MLB": "https://www.covers.com/sport/baseball/mlb/players/",
    #"NBA": "https://www.covers.com/sport/basketball/nba/players/"
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def scrape_players(url, league):
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    tr_tags = soup.find_all("tr")
    players = []
    positions = ["QB", "RB", "WR", "TE", "K"]

    for tr in tr_tags:
        name_td = tr.find('td')
        pos_td = name_td.find_next_sibling('td') if name_td else None
        team_td = pos_td.find_next_sibling('td') if pos_td else None

        if name_td and pos_td and team_td:
            name = name_td.get_text(strip=True)
            name_split = str(name).split(', ')
            full_name = name_split[1] + ' ' + name_split[0]
            pos = pos_td.get_text(strip=True)
            team = team_td.get_text(strip=True)

            if pos in positions:
                new_player = NFLPlayer(
                    name=full_name, 
                    team=team, 
                    position=pos
                )
                players.append(new_player.to_dict())
            
    return players

def add_defenses():
    nfl_teams = {
        'ARI': 'Arizona Cardinals',
        'ATL': 'Atlanta Falcons',
        'BAL': 'Baltimore Ravens',
        'BUF': 'Buffalo Bills',
        'CAR': 'Carolina Panthers',
        'CHI': 'Chicago Bears',
        'CIN': 'Cincinnati Bengals',
        'CLE': 'Cleveland Browns',
        'DAL': 'Dallas Cowboys',
        'DEN': 'Denver Broncos',
        'DET': 'Detroit Lions',
        'GB': 'Green Bay Packers',
        'HOU': 'Houston Texans',
        'IND': 'Indianapolis Colts',
        'JAX': 'Jacksonville Jaguars',
        'KC': 'Kansas City Chiefs',
        'LV': 'Las Vegas Raiders',
        'LAC': 'Los Angeles Chargers',
        'LAR': 'Los Angeles Rams',
        'MIA': 'Miami Dolphins',
        'MIN': 'Minnesota Vikings',
        'NE': 'New England Patriots',
        'NO': 'New Orleans Saints',
        'NYG': 'New York Giants',
        'NYJ': 'New York Jets',
        'PHI': 'Philadelphia Eagles',
        'PIT': 'Pittsburgh Steelers',
        'SF': 'San Francisco 49ers',
        'SEA': 'Seattle Seahawks',
        'TB': 'Tampa Bay Buccaneers',
        'TEN': 'Tennessee Titans',
        'WAS': 'Washington Commanders'
    }
    defenses = []
    for key, value in nfl_teams.items():
        new_player = NFLPlayer(
            name=value, 
            team=key, 
            position="DEF"
        )
        defenses.append(new_player.to_dict())
    
    return defenses

# Loop through each sport and each letter from 'a' to 'z'
for league, base_url in base_urls.items():
    player_list = []
    for letter in string.ascii_lowercase:
        url = f"{base_url}{letter}"
        print(f"Scraping URL: {url}")
        player_list.extend(scrape_players(url, league))

    player_list.extend(add_defenses())
    # Write to JSON file
    filename = f"{league.lower()}_players.json"
    with open(filename, 'w') as json_file:
        json.dump(player_list, json_file, indent=4)

    print(f"{league} player data has been written to {filename}")
