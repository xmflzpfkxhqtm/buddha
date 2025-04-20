'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAskStore } from '../../stores/askStore';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const models = [
  { id: 'gpt4.1', name: 'GPT-4.1', description: '가장 강력한 추론 능력' },
  { id: 'gpt4o', name: 'GPT-4o', description: '빠르고 정확한 균형' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '경제적인 선택' },
  { id: 'claude3.7', name: 'Claude 3.7', description: '인간적인 답변' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '구글의 최신 모델' },
  { id: 'o4-mini', name: 'O4 Mini', description: '인성과 창의성' },
  { id: 'grok', name: 'Grok 3', description: '유머와 창의성' },
];

export default function AskPage() {
  const router = useRouter();
  const {
    question,
    setQuestion,
    selectedModel,
    setSelectedModel,
    showModal,
    setShowModal,
    parentId,
    setParentId,
  } = useAskStore();

  const [previousQA, setPreviousQA] = useState<{ question: string; answer: string } | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false); // ✅ 모달 상태

  useEffect(() => {
    const fetchPrevious = async () => {
      if (!parentId) return;
      const { data, error } = await supabase
        .from('temp_answers')
        .select('question, answer')
        .eq('id', parentId)
        .single();
      if (data && !error) {
        setPreviousQA({ question: data.question, answer: data.answer });
      }
    };
    fetchPrevious();
  }, [parentId]);

  const handleNext = () => {
    if (!question.trim()) return;
    router.push('/ask/confirm');
  };

  const handleCancelFollowup = () => {
    setConfirmCancelModal(true);
  };

  const confirmCancel = () => {
    setParentId(null);
    setQuestion('');
    setPreviousQA(null); // ✅ 이거 추가
    setConfirmCancelModal(false);
    router.replace('/ask'); // ✅ 이걸로 바꿔줘
    
  };

  return (
    <>
      <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
        <div className="w-full z-1 pt-12">
          <h2 className="text-4xl text-red font-semibold text-start">
            부처님의 지혜에<br />귀를 기울여 보세요
          </h2>
          <p className="text-base text-red font-medium text-start mt-2">
            무엇이든 여쭈어 보세요.<br />부처님께서 답하십니다.
          </p>
        </div>

        {previousQA && (
          <div className="w-full bg-[#FFFDF8] border border-gray-200 p-4 mt-6 mb-4 rounded-xl text-sm">
            <p className="text-gray-500 font-medium mb-1">📌 이전 질문</p>
            <p className="text-black font-semibold mb-2 whitespace-pre-wrap">{previousQA.question}</p>
            <p className="text-gray-500 font-medium mb-1">🪷 부처님의 응답</p>
            <p className="text-black italic whitespace-pre-wrap">{previousQA.answer}</p>
            <button
              onClick={handleCancelFollowup}
              className="text-sm text-red mt-2 float-right"
            >
              이전 질문 삭제
            </button>
          </div>
        )}

        <div className="w-full h-16 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
          <Image src="/lotusbeige.png" alt="lotus" width={48} height={48} className="object-contain border-beige mx-2" />
          <div className="flex flex-col">
            <p className="text-sm font-base text-white text-start">
              한 자 한 자 마음을 담아 적어보세요.<br />
              말씀이 깊을수록, 깨달음도 또렷해집니다.
            </p>
          </div>
        </div>

        <div className="max-w-md w-full z-1 mt-6">
          <textarea
            className="w-full h-40 p-4 rounded-xl border border-red-light bg-[#FFFDF8] text-base resize-none focus:outline-none focus:ring-2 focus:ring-red"
            rows={5}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="마음을 담아 부처님께 여쭈고 싶은 이야기를 적어보세요"
          />
          <button
            onClick={() => setQuestion('')}
            className="text-sm text-red mt-0 float-right"
          >
            작성 내용 삭제
          </button>

          <div className="mt-12 mb-6">
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
      </main>

      {/* ✅ 확인 모달 */}
      {confirmCancelModal && (
        <div
          onClick={() => setConfirmCancelModal(false)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-[90%] max-w-[360px] text-center shadow-xl"
          >
            <p className="text-lg font-semibold text-red mb-4">정말 추가 질문을 취소할까요?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmCancelModal(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600"
              >
                아니오
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-light text-white rounded-lg text-sm"
              >
                네, 취소할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
