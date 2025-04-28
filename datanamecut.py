import os
import re

# 📂 수정할 폴더 경로 입력
folder_path = "./data"  # << 여기에 네 폴더 경로 입력

# 폴더 내 모든 파일 확인
for filename in os.listdir(folder_path):
    # .txt 파일만 처리
    if filename.endswith(".txt"):
        # _gpt 또는 _GPT 이후 ~ .txt 전까지 삭제
        new_filename = re.sub(r'(_[Gg][Pp][Tt].*?)\.txt$', '.txt', filename)
        
        # 이름이 바뀌는 경우만 처리
        if new_filename != filename:
            old_path = os.path.join(folder_path, filename)
            new_path = os.path.join(folder_path, new_filename)
            
            os.rename(old_path, new_path)
            print(f"✅ Renamed: {filename} → {new_filename}")

print("🎉 모든 파일 이름 수정 완료!")
