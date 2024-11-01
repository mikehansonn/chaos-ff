spots = {
    "QB": [0],
    "RB": [1, 2, 6],
    "WR": [3, 4, 6],
    "TE": [5, 6],
    "FLEX": [6],
    "DEF": [7],
    "K": [8],
    "BENCH": list(range(9, 17))
}

getter = spots.get("QB") + spots.get("BENCH")
print(getter)