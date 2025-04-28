import os
import unicodedata

data_dir = './data'

for filename in os.listdir(data_dir):
    if filename.endswith('.txt'):
        # BOM 제거, 공백 제거, 유니코드 NFC 정규화
        clean_name = filename.replace('\ufeff', '').replace(' ', '')
        clean_name = unicodedata.normalize('NFC', clean_name)

        old_path = os.path.join(data_dir, filename)
        new_path = os.path.join(data_dir, clean_name)

        if old_path != new_path:
            print(f"Renaming: {filename} -> {clean_name}")
            os.rename(old_path, new_path)
