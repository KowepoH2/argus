#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
#  GitHub Pages 초기 업로드 스크립트
#  실행 전: GitHub에서 repository를 먼저 만들어 주세요
#  실행: bash github_setup.sh
# ─────────────────────────────────────────────────────────────────────

# ⚙️ 여기를 먼저 수정하세요
GITHUB_USERNAME="wph2business"       # GitHub 사용자명
REPO_NAME="argus-h2-briefing"        # 저장소 이름 (소문자, 하이픈 권장)
# ─────────────────────────────────────────────────────────────────────

echo "🚀 GitHub Pages 설정 시작..."
echo ""

# Git 초기화
git init
git checkout -b main

# .gitignore 적용 후 파일 추가
git add .nojekyll index.html login.html dashboard.html auth.js
git add briefs/

# 선택: apps_script, 템플릿 파일 포함 여부
# git add apps_script_v2.js

echo "✅ 파일 스테이징 완료"

# 첫 커밋
git commit -m "Initial commit: Argus H2 briefing portal (Apr 7-9, 2026)"

# 원격 저장소 연결
git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

# 업로드
echo ""
echo "📤 GitHub에 업로드 중..."
git push -u origin main

echo ""
echo "✅ 완료!"
echo ""
echo "📌 다음 단계:"
echo "   1. https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/settings/pages 접속"
echo "   2. Source: 'Deploy from a branch'"
echo "   3. Branch: main / (root) 선택 후 Save"
echo ""
echo "🌐 포털 주소 (수 분 후 활성화):"
echo "   https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/"
