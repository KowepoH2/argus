# Argus GitHub 자동 Push — Windows 작업 스케줄러 등록 스크립트
# 관리자 권한으로 실행하거나, 일반 권한으로 실행 후 UAC 승인
# 실행방법: PowerShell에서 우클릭 → "PowerShell로 실행"

$TaskName    = "Argus_GitHub_AutoPush"
$ScriptPath  = "C:\Users\csy43\OneDrive\문서\claude\Argus\Argus 수소정보지 정리\자동_깃헙_push.py"
$PythonPath  = "python"   # python이 PATH에 없으면 전체 경로로 교체 (예: C:\Python312\python.exe)

# 평일 오전 9시 20분 실행 (Claude 스케쥴 작업 완료 후 20분 뒤)
$Trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday `
    -At "09:20"

$Action  = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "`"$ScriptPath`""

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# 현재 로그인 사용자로 등록 (비밀번호 불필요)
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

try {
    # 기존 태스크 있으면 삭제 후 재등록
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Trigger $Trigger `
        -Action $Action `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Argus H2 브리핑 포털 — Claude 작업 완료 후 GitHub Pages 자동 배포"

    Write-Host "✅ 작업 스케줄러 등록 완료!" -ForegroundColor Green
    Write-Host "   태스크명: $TaskName" -ForegroundColor Cyan
    Write-Host "   실행시간: 평일 오전 9:20" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "확인: 작업 스케줄러 앱 → 작업 스케줄러 라이브러리 → $TaskName" -ForegroundColor Yellow
} catch {
    Write-Host "❌ 등록 실패: $_" -ForegroundColor Red
    Write-Host "PowerShell을 관리자 권한으로 실행 후 다시 시도하세요." -ForegroundColor Yellow
}
