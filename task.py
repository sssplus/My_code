student_scores = [150, 142, 185, 120, 171, 184, 149, 24, 59, 68, 199, 78, 65, 89, 86, 55, 91, 64, 89]

# initial_score=0//will print individual score, though not intended in coding
# for score in student_scores:
#     total_score=initial_score+score
#     print(total_score)
tota_exam_score=sum(student_scores)
print(tota_exam_score)
# # print(range(1, 10))
# sum = 0
# for scores in student_scores:
#     sum+=scores
#
# print(sum)
# max_score=0
# for score in student_scores:
#     if score > max_score:
#         max_score=score
max_score=max(student_scores)
#
print(max_score)

# student_scores = [150, 142, 185, 120, 171, 184, 149, 24, 59, 68, 199, 78, 65, 89, 86, 55, 91, 64, 89]

# Calculate total score
# total_score = 0
# for score in student_scores:
#     total_score += score
#     print(total_score)
#
# # Calculate number of scores (without len())
# num_scores = 0
# for score in student_scores: # Or you could use a simple counter variable in the first loop
#     num_scores += 1
#     print(num_scores)
#
# # Calculate average
# if num_scores > 0: # Avoid division by zero if the list is empty
#     average_score = total_score / num_scores
#     print(f"The average score is: {average_score:.2f}") # .2f formats to 2 decimal places
# else:
#     print("Cannot calculate average for an empty list of scores.")