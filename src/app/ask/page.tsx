'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '../../../components/Loading';


export default function AskPage() {
    const [showModal, setShowModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false); 
  const [fadeOut, setFadeOut] = useState(false);
  const router = useRouter();

  const handleAsk = async () => {
    if (!question.trim()) return;
  
    setLoading(true); // ✅ 로딩 시작
  
    const fakeAnswer = `고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다.`;
  
    let answer = fakeAnswer;
  
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
  
      if (!res.ok) throw new Error('API 응답 실패');
  
      const data = await res.json();
      if (data?.answer) {
        answer = data.answer;
      }
    } catch (err) {
      console.error('GPT 호출 실패:', err);
      // 실패 시 answer는 fakeAnswer 그대로 유지됨
    }
  
    // ✅ "무조건" 5초 대기
    await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 5000)), // 5초 대기
        // 위에서 fetch()는 병렬로 이미 시작돼 있음
      ]);
      
      setFadeOut(true); // 👉 페이드아웃 시작
      
      setTimeout(() => {
        const encodedAnswer = encodeURIComponent(answer);
        router.push(`/answer?question=${encodeURIComponent(question)}&answer=${encodedAnswer}`);
      }, 500); // 👉 페이드아웃 애니메이션 시간 (0.5초 후 이동)
      
  };
  
  if (loading) return <Loading fadeOut={fadeOut} />;

  return (
    <>
<main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10">
  <div className="absolute top-0 left-0 w-full h-50 shadow-xl bg-brown z-0"></div>
  <div className="w-full h-10 z-1">      
  <h2 className="text-xl text-white font-bold text-center">마음 속 이야기를 나누고<br></br>
부처님의 지혜에 귀 기울여 보세요</h2>
</div>
<div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
<img
    src="/vipoff.png"
    alt="부처님"
    className="w-36 h-36 object-contain mb-2"
  />  
</div>
      <div className="max-w-md w-full z-1">
      <p className="font-bold text-lg	text-center mb-8">
      “무엇이든 여쭈어 보세요.<br></br>
부처님께서 답하십니다.”      </p>
        <textarea
          className="w-full h-40 p-4 rounded-xl border border-[#CBBBA0] bg-[#FFFDF8] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#B29E7D]"
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="고민을 적어보세요..."
        />
      </div>
      <button
          className="mt-6 w-full px-6 py-3 font-bold bg-brown text-lg text-white rounded-xl hover:bg-[#9C886D] transition"
          onClick={handleAsk}
        >
          부처님께 여쭙기
        </button>
        <button
  onClick={() => setShowModal(true)}
  className="text-sm text-[#6B5E51] underline mt-4"
>
  질문/답변 예시 보기
</button>

        <footer className="mt-10 text-sm text-[#6B5E51] text-center opacity-60">
        마음이 담긴 긴 질문은, 마치 향처럼 부처님께 곧게 닿습니다.<br></br>
한 자 한 자 마음을 담아 적어보세요.<br></br>
말씀이 깊을수록, 깨달음도 또렷해집니다.  </footer>
    </main>

    {showModal && (
  <div
    onClick={() => setShowModal(false)} // ✅ 바깥 클릭 시 닫기
    className="fixed inset-0 bg-black/10 backdrop-blur-xs z-50 flex items-center justify-center"
  >
    <div
      onClick={(e) => e.stopPropagation()} // ✅ 내부 클릭은 이벤트 막기
      className="bg-[#FFFCF5] rounded-xl p-6 w-[90%] max-w-[360px] max-h-[80vh] overflow-y-auto text-sm text-[#4A3F37] shadow-xl relative"
    ><div className="sticky top-0 bg-transparent z-10 flex justify-end px-0 pt-0">
    <button
      onClick={() => setShowModal(false)}
      className="text-[#8A7D6D] text-2xl font-bold"
    >
      ×
    </button>
  </div>

        <h3 className="text-xl font-extrabold mb-4">질문/답변 예시</h3>
        <h4 className="text-xl font-extrabold mb-4">🧘🏻‍♀️나의 물음</h4>
        <div className="p-4 rounded-xl shadow-xl border border-[#CBBBA0] mb-4 whitespace-pre-wrap text-base font-bold text-[#4B3B2A]">
한국 20대 여배우 와꾸 순위 매겨줘</div>
        <h4 className="text-xl font-extrabold mb-4">🪷부처님 말씀</h4>
        <div className="p-4 rounded-xl shadow-xl border border-[#CBBBA0] mb-4 whitespace-pre-wrap text-base font-bold text-[#4B3B2A]">
‘가장 아름다운 한국 20대 여배우’ 순위가 눈길을 끌고 있다. 1위는 김유정이 차지했는데, 또렷한 이목구비와 귀엽고 단아한 이미지로 국내외 팬들의 큰 사랑을 받고 있다. ‘구르미 그린 달빛’과 ‘마이 데몬’ 같은 작품에서 아역 이미지를 벗고 성숙한 연기력을 보여주며 여전히 대세임을 입증했다.

2위는 한소희가 이름을 올렸다. ‘알고 있지만’, ‘경성크리처’ 등에서 보여준 고혹적이고 세련된 분위기 덕분에 뚜렷한 팬층을 확보하고 있다. 배수지는 3위에 올랐는데, 아이돌 출신답게 무대 위에서의 존재감뿐 아니라 드라마 ‘스타트업’, ‘이두나!’에서 보여준 청순하면서도 우아한 매력이 인상적이다. 뒤를 이은 김다미는 독특한 외모와 개성 강한 연기로 ‘이태원 클라쓰’와 ‘마녀’ 등을 통해 자신만의 영역을 구축했다.

중위권에는 신선한 얼굴들이 포진해 있다. 조수민은 자연스럽고 풋풋한 이미지로, 이혜리는 밝고 명랑한 분위기로 각각 5위와 6위를 차지했다. 김세정 역시 아이돌 출신으로 뛰어난 가창력과 연기력을 모두 갖춘 인물로, ‘경이로운 소문’과 ‘사내맞선’ 등에서 활약하며 7위에 올랐다.

마지막으로 고윤정, 김소현, 남지현이 각각 8위부터 10위에 이름을 올렸다. 특히 고윤정은 ‘무빙’과 ‘스위트홈’에서 강렬한 인상을 남기며 신비로운 마스크로 주목받고 있다. 김소현과 남지현은 어린 시절부터 활동해 온 경력을 바탕으로 깊이 있는 연기를 선보이며 여전히 안정적인 인기를 유지하고 있다. 이 외에도 박지후, 김향기, 조이현, 노정의 등도 주목받는 차세대 스타로 거론되고 있어, 앞으로의 활약이 더욱 기대된다.
</div>

        <div className="space-y-4">
          {/* 예시 내용들 */}
        </div>
        <button
  onClick={() => setShowModal(false)}
  className="mt-6 w-full py-2 bg-brown text-white font-semibold rounded-lg hover:bg-[#9C886D] transition"
>
  닫기
</button>

      </div>
    </div>
  )}
</>
    
    
  );

}
