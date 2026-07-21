import pandas as pd

file_path = "/home/ubuntu/mcc-front/DIARIOS_2007_cobertura.xlsx"
df = pd.read_excel(file_path)

print(df.head())
print(df.columns)
