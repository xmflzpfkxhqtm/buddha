import os

# 📂 검사할 폴더 경로
folder_path = "./data"  # 여기에 네 폴더 경로 입력

for filename in os.listdir(folder_path):
    if filename.endswith(".txt"):
        file_path = os.path.join(folder_path, filename)

        # 파일 읽기
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        print(f"\n🔎 파일명: {filename}")

        # 파일 안에 \n이 하나라도 있으면
        if "\n" in content:
            print("✅ 줄바꿈(\\n)이 존재합니다. 줄별로 검사 시작합니다...")

            lines = content.splitlines()

            for i, line in enumerate(lines):
                if line.strip() == "":
                    print(f"📍 {i+1}번째 줄: 빈 줄")
                if line.startswith('”') and i > 0:
                    print(f"⚠️ {i+1}번째 줄: 따옴표(”)로 시작하는 줄 발견")
                if line.endswith('“'):
                    print(f"⚠️ {i+1}번째 줄: 따옴표(“)로 끝나는 줄 발견")
        else:
            print("🎯 줄바꿈(\\n) 없음, 깨끗한 파일입니다.")

print("\n🎉 모든 파일 검사 완료!")
