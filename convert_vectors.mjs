import { Pool } from 'pg';
import { cpus } from 'os';

// 데이터베이스 연결 설정
const pool = new Pool({
  user: 'postgres.ekqucunjkiimfisgiyfp',
  password: 'gkftndlTek1!',
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000  // 5분으로 타임아웃 늘림
});

// 배치 크기와 반복 횟수 설정
const BATCH_SIZE = 100; // 배치 크기
const MAX_ITERATIONS = 500;
const SLEEP_SECONDS = 1;
const PARALLEL_TASKS = Math.min(cpus().length - 1, 4); // CPU 코어 수에 기반한 병렬 작업 수 (최대 4개)

// 대기 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 함수가 존재하는지 확인
async function checkFunction() {
  const client = await pool.connect();
  try {
    // 새로운 함수 이름 사용
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'convert_to_halfvec_batch_v3'
      );
    `);
    
    if (!result.rows[0].exists) {
      console.log('convert_to_halfvec_batch_v3 함수가 존재하지 않습니다. 함수를 생성합니다.');
      
      // 새 이름으로 함수 생성 - 워커 ID를 추가로 받아 처리 범위를 분리
      await client.query(`
        CREATE OR REPLACE FUNCTION convert_to_halfvec_batch_v3(batch_size integer, worker_id integer, total_workers integer)
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE
          affected_count integer := 0;
          mod_value integer;
        BEGIN
          mod_value := total_workers;
          
          WITH to_update AS (
            SELECT id 
            FROM documents 
            WHERE embedding_half IS NULL
            AND MOD(id::bigint, mod_value) = worker_id - 1
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
          )
          UPDATE documents d
          SET embedding_half = d.embedding::halfvec
          FROM to_update
          WHERE d.id = to_update.id;
          
          GET DIAGNOSTICS affected_count = ROW_COUNT;
          RETURN affected_count;
        END;
        $$;
      `);
      
      console.log('함수가 성공적으로 생성되었습니다.');
    } else {
      console.log('convert_to_halfvec_batch_v3 함수가 이미 존재합니다.');
    }
  } catch (err) {
    console.error('함수 확인 중 오류:', err.message);
  } finally {
    client.release();
  }
}

// 단일 배치 처리 함수
async function processBatch(taskId, batchSize) {
  const client = await pool.connect();
  try {
    console.log(`[작업 ${taskId}] 배치 처리 시작 (크기: ${batchSize})...`);
    const result = await client.query(`
      SELECT convert_to_halfvec_batch_v3($1, $2, $3) as converted_count;
    `, [batchSize, taskId, PARALLEL_TASKS]);
    
    // 결과 확인
    if (result && result.rows && result.rows.length > 0 && result.rows[0].converted_count !== undefined) {
      const processed = parseInt(result.rows[0].converted_count);
      console.log(`[작업 ${taskId}] ${processed}개 행 처리 완료`);
      return processed;
    } else {
      console.log(`[작업 ${taskId}] 결과가 없거나 예상치 못한 형식: ${JSON.stringify(result.rows || {})}`);
      return 0;
    }
  } catch (err) {
    console.error(`[작업 ${taskId}] 오류 발생:`, err.message);
    // 지정된 시간 대기
    await sleep(SLEEP_SECONDS * 1000);
    return 0;
  } finally {
    client.release();
  }
}

// 진행 상황 확인 - 처리된 항목 수 기준으로 변경
async function checkProgress() {
  const client = await pool.connect();
  try {
    // 변환된 행과 총 행 수를 확인
    const res = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM documents WHERE embedding_half IS NOT NULL) as processed,
        (SELECT COUNT(*) FROM documents) as total
      LIMIT 1;
    `);
    
    const processed = parseInt(res.rows[0].processed);
    const total = parseInt(res.rows[0].total);
    const remaining = total - processed;
    const percentage = (processed / total * 100).toFixed(2);
    
    console.log(`진행 상황: ${processed}/${total} (${percentage}%) 처리됨. 남은 항목: ${remaining}개`);
    
    return remaining === 0;
  } catch (err) {
    console.error('진행 상황 확인 오류:', err.message);
    return false;
  } finally {
    client.release();
  }
}

// 작업자 함수 - 연속적으로 배치 처리
async function worker(taskId, batchSize, shouldStop, globalStats) {
  let processed = 0;
  let consecutiveErrors = 0;
  let sleepTime = SLEEP_SECONDS * 1000;
  
  while (!shouldStop.stop) {
    try {
      const batchProcessed = await processBatch(taskId, batchSize);
      processed += batchProcessed;
      
      // 전역 처리 통계 업데이트
      if (globalStats) {
        globalStats.processed += batchProcessed;
      }
      
      if (batchProcessed === 0) {
        consecutiveErrors++;
        
        // 연속으로 실패 시 대기 시간 증가 (지수 백오프)
        if (consecutiveErrors >= 3) {
          sleepTime = Math.min(SLEEP_SECONDS * 1000 * Math.pow(2, consecutiveErrors-2), 30000);
          console.log(`[작업 ${taskId}] 연속 ${consecutiveErrors}회 처리 실패, ${sleepTime/1000}초 대기...`);
          await sleep(sleepTime);
        } else {
          await sleep(SLEEP_SECONDS * 1000);
        }
      } else {
        // 성공 시 에러 카운트 및 대기 시간 초기화
        consecutiveErrors = 0;
        sleepTime = SLEEP_SECONDS * 1000;
        
        // 처리가 성공하면 짧게 쉬기
        await sleep(100);
      }
    } catch (err) {
      console.error(`[작업 ${taskId}] 예상치 못한 오류:`, err);
      consecutiveErrors++;
      await sleep(sleepTime);
    }
  }
  
  console.log(`[작업 ${taskId}] 작업 종료. 총 ${processed}개 행 처리됨`);
  return processed;
}

async function main() {
  console.log('=== 벡터 변환 자동화 스크립트 시작 (병렬 처리 - 연속 실행) ===');
  console.log(`배치 크기: ${BATCH_SIZE}, 병렬 작업 수: ${PARALLEL_TASKS}, 최대 반복: ${MAX_ITERATIONS}`);
  
  try {
    // 초기 연결 테스트
    const testClient = await pool.connect();
    console.log('데이터베이스 연결 성공!');
    testClient.release();
    
    // 함수 존재 확인 및 필요시 생성 (초기 상태 체크보다 먼저 실행)
    await checkFunction();
    
    // 초기 상태 확인
    await checkProgress();
    
    // 작업 중지 신호 객체
    const shouldStop = { stop: false };
    
    // 공유 통계 객체
    const globalStats = { processed: 0, lastCheckedTotal: 0 };
    
    // 작업자 시작
    console.log(`${PARALLEL_TASKS}개의 병렬 작업자 시작...`);
    const workers = Array.from({ length: PARALLEL_TASKS }, (_, i) => 
      worker(i + 1, BATCH_SIZE, shouldStop, globalStats)
    );
    
    // 주기적으로 진행 상황 확인
    let iteration = 0;
    let lastProcessed = 0;
    let stuckCounter = 0;
    
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      
      // 30초마다 진행 상황 체크 (빠른 모니터링)
      await sleep(30000);
      
      console.log(`=== 반복 ${iteration}/${MAX_ITERATIONS} 상태 확인 중... ===`);
      const completed = await checkProgress();
      
      // 변환 완료 여부 확인
      if (completed) {
        console.log('모든 데이터가 변환된 것으로 판단됩니다. 작업을 중지합니다.');
        shouldStop.stop = true;
        break;
      }
      
      // 진행 상황이 멈췄는지 확인 (처리된 건수로 확인)
      if (globalStats.processed === lastProcessed && globalStats.processed > 0) {
        stuckCounter++;
        console.log(`진행 상황이 멈춘 것 같습니다. (${stuckCounter}/5) - 총 처리된 항목: ${globalStats.processed}개`);
        
        // 5번 연속으로 진행이 없으면 로그 출력 후 계속 진행
        if (stuckCounter >= 5) {
          console.log('진행이 멈췄습니다. 함수 재생성 시도...');
          
          // 기존 함수 삭제 후 재생성
          try {
            const dropClient = await pool.connect();
            await dropClient.query(`DROP FUNCTION IF EXISTS convert_to_halfvec_batch_v3(integer, integer, integer);`);
            dropClient.release();
            console.log('기존 함수를 삭제했습니다.');
          } catch (err) {
            console.error('함수 삭제 중 오류:', err.message);
          }
          
          await checkFunction(); // 함수 재생성 시도
          stuckCounter = 0;
        }
      } else {
        stuckCounter = 0;
        lastProcessed = globalStats.processed;
      }
    }
    
    // 작업 중지 신호 전송
    console.log('작업을 종료합니다...');
    shouldStop.stop = true;
    
    // 모든 작업자가 종료될 때까지 대기
    const results = await Promise.all(workers);
    const totalProcessed = results.reduce((sum, count) => sum + count, 0);
    
    console.log(`총 처리된 행 수: ${totalProcessed}`);
    
  } catch (err) {
    console.error('오류 발생:', err);
  } finally {
    await pool.end();
    console.log('=== 벡터 변환 자동화 스크립트 종료 ===');
  }
}

main();