'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import BottomNav from '../../../components/BottomNav';

const models = [
  { id: 'gpt4.1', name: 'GPT-4.1', description: '가장 강력한 추론 능력' },
  { id: 'gpt4o', name: 'GPT-4o', description: '빠르고 정확한 균형' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '경제적인 선택' },
  { id: 'claude3.7', name: 'Claude 3.7', description: '인간적인 답변' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '구글의 최신 모델' },
  { id: 'o4-mini', name: 'O4 Mini', description: '인성과 창의성' },
  { id: 'grok', name: 'Grok 3', description: '유머와 창의성' },
];

export default function AskClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [showModal, setShowModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt4.1');

  useEffect(() => {
    const q = params.get('question');
    const m = params.get('model');
    if (q) setQuestion(q);
    if (m) setSelectedModel(m);
  }, [params]);

  const handleNext = () => {
    if (!question.trim()) return;
    router.push(`/ask/confirm?question=${encodeURIComponent(question)}&model=${selectedModel}`);
  };

  return (
    <>
      <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
        <div className="w-full z-1 pt-12">
          <h2 className="text-4xl text-red font-semibold text-start">
            부처님의 지혜에<br />귀를 기울여 보세요
          </h2>
          <p className="text-lg text-red font-medium text-start mt-2">
            무엇이든 여쭈어 보세요.<br />부처님께서 답하십니다.
          </p>
        </div>

        <div className="w-full h-16 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
          <Image
            src="/lotusbeige.png"
            alt="lotus"
            width={48}
            height={48}
            className="object-contain border-beige mx-2"
          />
          <div className="flex flex-col">
            <p className="text font-base text-white text-start">
              한 자 한 자 마음을 담아 적어보세요.</p>
            <p className="text font-base text-white text-start">
              말씀이 깊을수록, 깨달음도 또렷해집니다.</p>
          </div>
        </div>

        <div className="max-w-md w-full z-1 mt-6">
          <textarea
            className="w-full h-40 p-4 rounded-xl border border-[#CBBBA0] bg-[#FFFDF8] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#B29E7D]"
            rows={5}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="고민을 적어보세요..."
          />

          <div className="mt-4 mb-6">
            <p className="font-bold text-sm mb-2">부처님의 지혜를 빌려올 원천을 선택하세요(QA용)</p>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedModel === model.id 
                      ? 'border border-red bg-red-light text-white' 
                      : 'border border-red bg-white text-black'
                  }`}
                >
                  <div className="font-bold text-sm">{model.name}</div>
                  <div className="text-xs mt-1">{model.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          className="mt-2 w-full px-6 py-3 font-bold bg-red-light text-lg text-white rounded-4xl hover:bg-red transition"
          onClick={handleNext}
          disabled={!question.trim()}
        >
          제출하기
        </button>

        <button
          onClick={() => setShowModal(true)}
          className="text-sm text-black underline mt-4 mb-12"
        >
          어떻게 사용하는 건가요?
        </button>

        <BottomNav />
      </main>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 bg-black/10 backdrop-blur-xs z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFCF5] rounded-xl p-6 w-[90%] max-w-[360px] max-h-[80vh] overflow-y-auto text-sm text-black shadow-xl relative"
          >
            <div className="sticky top-0 bg-transparent z-10 flex justify-end px-0 pt-0">
              <button
                onClick={() => setShowModal(false)}
                className="text-[#8A7D6D] text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="text-base text-left leading-relaxed space-y-2">
              <p>처음 오신 것을 진심으로 환영합니다. 🙏</p>
              <p>이곳은 인공지능(AI)을 통해 부처님의 가르침을 전해드리는 마음 쉼터입니다.</p>
              <p>괴로움이 있으시거나, 답을 찾기 어려운 일이 있다면 마치 부처님께 조용히 기도드리듯, 편안한 마음으로 말씀 남겨주세요.</p>
              <p>고민을 상세히 적어주실수록, 보다 자비롭고 깊이 있는 답을 전해드릴 수 있습니다.</p>
              <p>남기신 말씀은 외부에 공개되지 않으며, 오직 당신과 AI 부처님만이 함께 나누는 대화입니다.</p>
              <p>스스로를 돌보는 시간, 지금 이 순간이 작은 수행이 될 수 있습니다. 🪷</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
