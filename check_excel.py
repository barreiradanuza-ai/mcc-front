import pandas as pd

file_path = "/home/ubuntu/Downloads/DIARIOS_2007(1)_cobertura.xlsx"
df = pd.read_excel(file_path)

print(df.head())
print(df.columns)
