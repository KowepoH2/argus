/**
 * Argus 수소·암모니아 PDF → OCR → 한글 번역 자동화 스크립트 v3.2
 *
 * 변경 이력:
 *  v3.2 (2026-05-22) — Gmail 검색 조건 수정
 *    - processArgusEmails(): 발신자를 notifications@argusmedia.com → choosy@iwest.co.kr 로 변경
 *      (Argus 메일이 직접 수신이 아닌 추승엽 님 전달(FW) 방식으로 수신됨)
 *    - 검색 조건에 subject:Argus 추가하여 Argus 관련 메일만 선별
 *  v3.1 (2026-05-14) — OCR 오류 처리 강화
 *    - ocrPdf(): 최대 3회 재시도 + 지수 백오프 (2s → 4s → 8s)
 *    - processArgusEmails(): OCR 실패 시 Argus-processed 라벨 미부여 → 다음 실행 시 자동 재시도
 *    - recoverFailedOcr(): 누락된 PDF 수동 복구 함수 추가
 *
 * 기능:
 *  1. Gmail에서 Argus PDF 첨부파일 수신 감지
 *  2. Google Drive PDF 폴더에 저장
 *  3. Drive OCR로 영문 텍스트 추출 → OCR 폴더에 저장
 *  4. LanguageApp으로 한글 번역 → 번역본 폴더에 저장
 *
 * 설정값 (아래 4개 폴더 ID만 본인 것으로 교체하세요)
 */

// ── 폴더 ID 설정 ─────────────────────────────────────────────
const PDF_FOLDER_ID   = '1oMyl4hTVN8chOw5MPLQKYWdMonStRLxo'; // 원문 PDF 저장 폴더
const OCR_FOLDER_ID   = '1R3F2gqKA4m4lKi7dA-E-f_vtXjqDLDug'; // OCR 영문 결과 폴더
const TRANS_FOLDER_ID = '1Gw18D61S2DFNG1MVnvvBTIf9Yr7hLjFH'; // 번역본 폴더
const PROCESSED_LABEL = 'Argus-processed';                    // 처리 완료 Gmail 라벨

// ── 메인 실행 함수 (트리거 연결) ─────────────────────────────
function processArgusEmails() {
  const label   = getOrCreateLabel(PROCESSED_LABEL);
  const threads = GmailApp.search(
    'from:choosy@iwest.co.kr subject:Argus has:attachment -label:' + PROCESSED_LABEL,
    0, 10
  );

  threads.forEach(thread => {
    let allSuccess = true; // 이 스레드의 모든 첨부파일 OCR 성공 여부

    thread.getMessages().forEach(msg => {
      msg.getAttachments().forEach(att => {
        const name = att.getName();
        if (!name.toLowerCase().endsWith('.pdf')) return;

        try {
          // 1) PDF 저장
          const pdfBlob   = att.copyBlob().setName(name);
          const pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);

          const monthKey    = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
          const monthFolder = getOrCreateSubfolder(pdfFolder, monthKey);
          const pdfFile     = monthFolder.createFile(pdfBlob);

          // 2) OCR → 영문 Google Doc (재시도 포함)
          const ocrDocId = ocrPdf(pdfFile.getId(), name.replace('.pdf', ''), OCR_FOLDER_ID);

          if (!ocrDocId) {
            // OCR 최종 실패 — 이 스레드는 처리 완료로 표시하지 않음
            Logger.log('⚠️ OCR 최종 실패 — 다음 실행 시 재시도 예정: ' + name);
            allSuccess = false;
            return; // 이 첨부파일 건너뜀
          }

          // 3) 한글 번역본 생성
          if (TRANS_FOLDER_ID !== 'YOUR_TRANSLATION_FOLDER_ID') {
            translateDocToKorean(ocrDocId, name.replace('.pdf', ''), TRANS_FOLDER_ID);
          }

          Logger.log('✅ 완료: ' + name);

        } catch (e) {
          Logger.log('❌ 오류 [' + name + ']: ' + e.message);
          allSuccess = false;
        }
      });
    });

    // ★ 핵심 수정: 모든 첨부파일 OCR 성공 시에만 처리 완료 라벨 부여
    if (allSuccess) {
      thread.addLabel(label);
      Logger.log('라벨 부여 완료: ' + thread.getFirstMessageSubject());
    } else {
      Logger.log('⚠️ 일부 OCR 실패 — 라벨 미부여, 다음 실행 시 재시도: '
                 + thread.getFirstMessageSubject());
    }
  });
}

// ── OCR 함수 (재시도 로직 포함) ──────────────────────────────
function ocrPdf(pdfFileId, baseName, targetFolderId) {
  const token        = ScriptApp.getOAuthToken();
  const MAX_RETRIES  = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // ms — 지수 백오프

  const payload = JSON.stringify({
    name    : baseName + '_OCR',
    parents : [targetFolderId],
    mimeType: 'application/vnd.google-apps.document'
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + pdfFileId + '/copy',
      {
        method            : 'POST',
        contentType       : 'application/json',
        headers           : { Authorization: 'Bearer ' + token },
        payload           : payload,
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(resp.getContentText());

    if (!result.error) {
      const retryInfo = attempt > 1 ? ' (시도 ' + attempt + '회 만에 성공)' : '';
      Logger.log('OCR 완료: ' + result.id + retryInfo);
      return result.id;
    }

    Logger.log('OCR 오류 (시도 ' + attempt + '/' + MAX_RETRIES + '): '
               + JSON.stringify(result.error));

    if (attempt < MAX_RETRIES) {
      Logger.log('재시도 대기 ' + RETRY_DELAYS[attempt - 1] + 'ms...');
      Utilities.sleep(RETRY_DELAYS[attempt - 1]);
    }
  }

  Logger.log('OCR 최종 실패 (3회 모두 실패): ' + baseName);
  return null;
}

// ── 한글 번역 함수 ───────────────────────────────────────────
function translateDocToKorean(ocrDocId, baseName, transFolderId) {
  const srcDoc  = DocumentApp.openById(ocrDocId);
  const body    = srcDoc.getBody();
  const srcText = body.getText();

  if (!srcText || srcText.trim().length === 0) {
    Logger.log('번역 건너뜀 — 빈 문서: ' + ocrDocId);
    return;
  }

  // Google Apps Script 내장 번역 함수 (영어 → 한국어)
  // 텍스트가 길면 4500자 단위로 분할 번역
  const CHUNK = 4500;
  let translated = '';

  if (srcText.length <= CHUNK) {
    translated = LanguageApp.translate(srcText, 'en', 'ko');
  } else {
    const chunks = [];
    for (let i = 0; i < srcText.length; i += CHUNK) {
      chunks.push(srcText.substring(i, i + CHUNK));
    }
    chunks.forEach((chunk, idx) => {
      if (idx > 0) Utilities.sleep(500);
      translated += LanguageApp.translate(chunk, 'en', 'ko') + '\n';
    });
  }

  // 번역본 문서 생성
  const transFolder = DriveApp.getFolderById(transFolderId);
  const dateStr     = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy.MM.dd');
  const newDocName  = baseName + '_번역본';

  const newDoc  = DocumentApp.create(newDocName);
  const newBody = newDoc.getBody();

  newBody.appendParagraph('[Argus Media 한글 번역본]')
         .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  newBody.appendParagraph('원본: ' + baseName + '  |  번역일: ' + dateStr)
         .setFontSize(10);
  newBody.appendHorizontalRule();
  newBody.appendParagraph(translated);

  newDoc.saveAndClose();

  const newFile = DriveApp.getFileById(newDoc.getId());
  transFolder.addFile(newFile);
  DriveApp.getRootFolder().removeFile(newFile);

  Logger.log('번역본 생성 완료: ' + newDocName + ' (' + newDoc.getId() + ')');
  return newDoc.getId();
}

// ── 누락 파일 수동 복구 함수 ─────────────────────────────────
/**
 * OCR/번역이 누락된 PDF를 수동으로 복구합니다.
 *
 * 사용법:
 *  1. 아래 TARGET_NAME에 복구할 파일명(.pdf 제외)을 입력
 *  2. Apps Script 편집기에서 이 함수를 선택 후 ▶ 실행
 *
 * 현재 복구 대상: 20260512fmbamm
 */
function recoverFailedOcr() {
  const TARGET_NAME = '20260512fmbamm'; // ← 복구할 파일명 (.pdf 제외)

  Logger.log('복구 시작: ' + TARGET_NAME + '.pdf');

  // PDF 폴더 및 월별 하위 폴더에서 파일 검색
  const pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);
  let pdfFile = null;

  // 최상위 폴더 검색
  const rootIter = pdfFolder.getFilesByName(TARGET_NAME + '.pdf');
  if (rootIter.hasNext()) {
    pdfFile = rootIter.next();
  }

  // 월별 하위 폴더 검색
  if (!pdfFile) {
    const subfolders = pdfFolder.getFolders();
    while (subfolders.hasNext() && !pdfFile) {
      const subfolder = subfolders.next();
      const fileIter  = subfolder.getFilesByName(TARGET_NAME + '.pdf');
      if (fileIter.hasNext()) {
        pdfFile = fileIter.next();
      }
    }
  }

  if (!pdfFile) {
    Logger.log('❌ 파일을 찾을 수 없음: ' + TARGET_NAME + '.pdf');
    Logger.log('   PDF 폴더를 직접 확인하세요: https://drive.google.com/drive/folders/' + PDF_FOLDER_ID);
    return;
  }

  Logger.log('파일 발견: ' + pdfFile.getName() + ' (ID: ' + pdfFile.getId() + ')');

  // OCR 폴더에 이미 동일 파일이 있으면 번역만 재실행
  const ocrFolder   = DriveApp.getFolderById(OCR_FOLDER_ID);
  const existingOcr = ocrFolder.getFilesByName(TARGET_NAME + '_OCR');
  if (existingOcr.hasNext()) {
    const existingDoc = existingOcr.next();
    Logger.log('OCR 파일 이미 존재: ' + existingDoc.getId() + ' — 번역만 재실행합니다.');
    translateDocToKorean(existingDoc.getId(), TARGET_NAME, TRANS_FOLDER_ID);
    Logger.log('✅ 복구 완료 (번역만): ' + TARGET_NAME);
    return;
  }

  // OCR 재실행
  const ocrDocId = ocrPdf(pdfFile.getId(), TARGET_NAME, OCR_FOLDER_ID);
  if (!ocrDocId) {
    Logger.log('❌ OCR 복구 실패 — Drive API 상태를 확인하고 잠시 후 다시 시도하세요.');
    return;
  }

  // 번역 실행
  translateDocToKorean(ocrDocId, TARGET_NAME, TRANS_FOLDER_ID);
  Logger.log('✅ 복구 완료: ' + TARGET_NAME);
}

// ── 기존 OCR 파일 소급 번역 함수 (수동 1회 실행) ─────────────
/**
 * OCR 폴더에 있는 파일 중 번역본이 없는 것만 골라 한글 번역본을 생성합니다.
 * 사용법: Apps Script 편집기에서 이 함수를 선택 후 ▶ 실행
 */
function translateExistingOcrDocs() {
  const ocrFolder   = DriveApp.getFolderById(OCR_FOLDER_ID);
  const transFolder = DriveApp.getFolderById(TRANS_FOLDER_ID);

  const existingNames = {};
  const existIter = transFolder.getFiles();
  while (existIter.hasNext()) {
    const f = existIter.next();
    existingNames[f.getName()] = true;
  }

  const ocrIter = ocrFolder.getFiles();
  let count = 0;

  while (ocrIter.hasNext()) {
    const file = ocrIter.next();
    if (file.getMimeType() !== 'application/vnd.google-apps.document') continue;

    const baseName   = file.getName().replace(/_OCR$/, '');
    const targetName = baseName + '_번역본';

    if (existingNames[targetName]) {
      Logger.log('건너뜀 (이미 번역됨): ' + targetName);
      continue;
    }

    Logger.log('번역 시작: ' + file.getName());
    try {
      translateDocToKorean(file.getId(), baseName, TRANS_FOLDER_ID);
      count++;
      Utilities.sleep(1000);
    } catch (e) {
      Logger.log('오류 [' + file.getName() + ']: ' + e.message);
    }
  }

  Logger.log('소급 번역 완료 — 총 ' + count + '건 생성');
}

// ── 유틸리티 함수 ────────────────────────────────────────────
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function getOrCreateSubfolder(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parentFolder.createFolder(name);
}

// ── 트리거 설정 함수 (최초 1회 실행) ─────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processArgusEmails')
           .timeBased()
           .everyHours(1)
           .create();
  Logger.log('트리거 설정 완료 (1시간 간격)');
}
