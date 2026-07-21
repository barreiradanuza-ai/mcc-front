import pandas as pd

file_path = "/home/ubuntu/upload/DIARIOS_2007(1).xlsx"
df = pd.read_excel(file_path)

print(df.head())
print(df.columns)
