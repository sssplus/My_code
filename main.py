# # TODO-1: Ask the user for input
from art import logo
# print("Welcome to the Auction!")
# print(logo)
#
# # TODO-2: Save data into dictionary {name: price}
# def highest_bidder(bidding_record):
#     winner= ""
#     highest_bid=0
#     bids= {name: bidding}
#     while continue_bidding:
#         for bidder in bidding_record:
#             if bidder==highest_bid:
#                 bidder.append(bids)
#             elif bidder> highest_bid:
#                 bidder=winner
#         print(f"The winner is {winner} with a bid of ${highest_bid}")
#
# # TODO-3: Whether if new bids need to be added
#
# # TODO-4: Compare bids in dictionary
#
# bids = {}
# continue_bidding = True
# while continue_bidding:
#     user = input("Are there new user? (Y/N):").lower()
#     if user == "y":
#         continue_bidding = True
#         print("Bid your price!")
#         name = input("What is the name of the user?")
#         user_no = []
#         no_of_user = int(input("How many user will be taking part:"))
#         bidding = input(f"What is the initial bid price {user_no}:")
#     elif user == "y":
#         print("\n" * 20)
#     elif user == "n":
#         exit()
#
#
# # Assuming 'art' module and 'logo' exist for your program
# from art import logo

# TODO-1: Ask the user for input
print("Welcome to the Auction!")
print(logo)

# --- Correction 1: Use no_of_user to control the loop ---
# Instead of an open-ended "Are there new user?", we'll loop
# 'no_of_user' times to collect bids.
user_no = [] # This list is still not strictly necessary for the core logic,
             # but we'll keep it as you had it, though it won't be used for indexing.
             # If you meant to store user names here, it would be 'user_names'.

# Get the number of participants.
# Add a try-except to ensure valid integer input for 'no_of_user'.
while True:
    try:
        no_of_user = int(input("How many users will be taking part: "))
        if no_of_user > 0:
            break
        else:
            print("Please enter a positive number of users.")
    except ValueError:
        print("Invalid input. Please enter a number.")


# Initialize the dictionary to store bids
bids = {} # This will store {name: bid_price}

# --- This section replaces your original 'while continue_bidding' loop for collecting bids ---
# We now loop 'no_of_user' times.
for i in range(no_of_user):
    print(f"\n--- Bidder {i + 1} of {no_of_user} ---") # Added clear prompt for current bidder
    name = input("What is the name of the user? ")

    # --- Correction 2: Ensure bid price is an integer and handle invalid input ---
    while True:
        try:
            # Mistake in original: f-string with user_no was "What is the initial bid price []:"
            # Corrected to use current bidder's name for clarity.
            bidding_price = int(input(f"What is {name}'s initial bid price? $"))
            break # Exit inner loop if input is valid
        except ValueError:
            print("Invalid bid. Please enter a whole number for the price.")

    # --- TODO-2: Save data into dictionary {name: price} ---
    # This is where we correctly save the bid.
    bids[name] = bidding_price

    # Optional: Clear the screen for the next bidder for a "blind auction" feel
    # This would replace your 'print("\n" * 20)' idea.
    # import os
    # os.system('cls' if os.name == 'nt' else 'clear') # Uncomment these two lines if you want to clear screen
    # print(logo) # Uncomment if clearing screen to show logo again


# --- TODO-3: Whether if new bids need to be added ---
# Your original code used this to control the input loop.
# In this refined structure, the `for i in range(no_of_user):` loop
# implicitly handles this by running for the specified number of users.
# If you still want to allow an "Are there new users?" prompt, it would be *after*
# this loop, to decide if you want to allow *more* than the initial `no_of_user`.
# For now, we'll assume `no_of_user` is definitive.

# --- TODO-4: Compare bids in dictionary ---
# This is where the function will be called *after* all bids are collected.

def highest_bidder(bidding_record):
    """
    Finds the bidder with the highest bid from the bidding_record dictionary.
    """
    winner = ""
    highest_bid = 0 # Initialize with a low value

    # --- Correction 3: Iterate correctly over dictionary items ---
    # We need both the name (key) and the bid (value) from the dictionary.
    # Mistake in original: 'for bidder in bidding_record' gave only keys.
    for name_of_bidder, bid_amount in bidding_record.items():
        # --- Correction 4: Correct comparison logic ---
        # Mistake in original: 'bidder == highest_bid' (string vs int)
        # Mistake in original: 'bidder > highest_bid' (string vs int)
        # Corrected: Compare 'bid_amount' (integer) to 'highest_bid' (integer)
        if bid_amount > highest_bid:
            highest_bid = bid_amount
            winner = name_of_bidder # --- Correction 5: Assign the name to winner ---
                                   # Mistake in original: 'bidder=winner' (assigned empty string to bidder variable)
        # --- Removed problematic else-if/append logic from original ---
        # Your original 'if bidder==highest_bid: bidder.append(bids)' was incorrect.
        # Handling ties would require a different approach (e.g., storing multiple winners in a list).
        # For simplicity, this code takes the first one encountered if bids are tied.

    # --- Correction 6: Print result OUTSIDE the loop ---
    # Mistake in original: print was inside the for loop.
    if winner: # Check if a winner was found (i.e., if there were any bids)
        print("\n--- Auction Results ---")
        print(f"The winner is {winner} with a bid of ${highest_bid}.")
    else:
        print("\nNo bids were placed in this auction.")


# --- Calling the highest_bidder function after all bids are collected ---
# This is done *once* after the input loop is complete.
highest_bidder(bids) # Pass the collected 'bids' dictionary to the function