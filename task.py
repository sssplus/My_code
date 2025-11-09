letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
symbols = ['!', '#', '$', '%', '&', '(', ')', '*', '+']
import random
print("Welcome to the PyPassword Generator!")
nr_letters = int(input("How many letters would you like in your password?\n"))
nr_symbols = int(input(f"How many symbols would you like?\n"))
nr_numbers = int(input(f"How many numbers would you like?\n"))

password_list=[]
for char in range(0, nr_letters):
    password_list.append(random.choice(letters))
    # print(password)
for char in range(0, nr_numbers):
    password_list.append(random.choice(numbers))
for char in range(0, nr_symbols):
    password_list.append(random.choice(symbols))

print(password_list)
random.shuffle(password_list)
print(password_list)
password = ""
for char in password_list:
    password += char

print(f"Your password is: {password}")


 #From me
password_list=[]

for letter in range(nr_letters):
    random_letters=random.choice(letters)
    password_list.append(random_letters)
for number in range(nr_numbers):
    random_numbers=random.choice(numbers)
    password_list.append(random_numbers)
for symbol in range(nr_symbols):
    random_symbols=random.choice(symbols)
    password_list.append(random_symbols)

random.shuffle(password_list)
generate_password="".join(password_list)
print(f"Your generated password is:{generate_password}")