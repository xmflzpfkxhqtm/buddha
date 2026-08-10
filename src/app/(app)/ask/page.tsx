'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAskStore } from '../../../stores/askStore';
import { useAskCitationStore, type AskCitation } from '@/stores/useAskCitationStore';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';
import { buildCitedQuestion } from '@/lib/askBuddha';
import { type TempAnswer } from '@/types/answers';
import { formatScriptureTitle } from '@/lib/titleFormatting';

// const models = [
//   { id: 'gpt4.1', name: 'GPT-4.1', description: '가장 강력한 추론 능력' },
//   { id: 'gpt4o', name: 'GPT-4o', description: '빠르고 정확한 균형' },
//   { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '경제적인 선택' },
//   { id: 'claude3.7', name: 'Claude 3.7', description: '인간적인 답변' },
//   { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '구글의 최신 모델' },
//   { id: 'o4-mini', name: 'O4 Mini', description: '인성과 창의성' },
//   { id: 'grok', name: 'Grok 3', description: '유머와 창의성' },
// ];
const exampleQuestions = [
  '죽음이 두려울 때 어떻게 마음을 다잡을 수 있을까요?',
  '공(空)을 이해하는 것과 삶에서 진정으로 체득하는 것 사이에는 어떤 차이가 있을까요?',
  '인연에 너무 몰입하고 나를 잃어가는 기분이에요. 어떻게 중심을 잡을 수 있을까요?',
  '“무언가를 끊임없이 바라고, 더 가지려는 제 마음이 지칩니다. 조금은 내려놓고 편안해지고 싶은데, 어떻게 하면 욕심을 놓을 수 있을까요?',
  '나이 들어가니 외롭고 허할 때가 많습니다. 이런 마음도 괜찮은 걸까요?',
'몸이 자주 아프다 보니 마음도 자꾸 움츠러듭니다. 병과 함께 사는 삶에도 평안이 있을까요?'
];

const lengths = [
  { id: 'short', name: '짧은 답변', description: '간결하지만 깊은 통찰이 담긴 가르침을 빠르게 받아보세요.' },
  { id: 'long', name: '긴 답변', description: '깊이 있는 가르침이 마음 속에 함께 긴 여운을 남깁니다.' },
];

export default function AskPage() {
  const router = useRouter();
  const {
    question,
    setQuestion,
    selectedModel,
    setSelectedModel,
    selectedLength,
    setSelectedLength,
    parentId,
    setParentId,
  } = useAskStore();
  const [showExamples, setShowExamples] = useState(false);

  // 경전 selection 에서 넘어온 인용 컨텍스트 — mount 시 한 번 consume.
  const consumeCitation = useAskCitationStore((s) => s.consume);
  const [citation, setCitation] = useState<AskCitation | null>(null);
  useEffect(() => {
    const c = consumeCitation();
    if (c) setCitation(c);
  }, [consumeCitation]);

  const [previousQA, setPreviousQA] = useState<{ question: string; answer: string } | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<TempAnswer[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<TempAnswer | null>(null);

  useEffect(() => {
    // 모델 선택 UI를 감춰뒀으므로 진입 시 강제 설정
    if (selectedModel !== 'gpt-4.1-mini') {
      setSelectedModel('gpt-4.1-mini');
    }
  }, [selectedModel, setSelectedModel]);
  

  useEffect(() => {
    const fetchPrevious = async () => {
      if (!parentId) return;
      const { data } = await supabase.from('temp_answers').select('question, answer').eq('id', parentId).single();
      if (data) setPreviousQA(data);
    };

    const fetchUserAndSaved = async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
      if (userData.user) {
        const { data: answers } = await supabase
          .from('temp_answers')
          .select('id, question, answer, created_at')
          .eq('user_id', userData.user.id)
          .eq('is_saved', true)
          .order('saved_at', { ascending: false })
          .limit(5);
        setSavedAnswers(answers || []);
      }
    };

    fetchPrevious();
    fetchUserAndSaved();
  }, [parentId]);

  const handleNext = () => {
    // citation 만 있어도 submit 허용 (자동 prompt 추가)
    if (!question.trim() && !citation) return;
    if (citation) {
      setQuestion(buildCitedQuestion({ text: citation.text, titleClean: formatScriptureTitle(citation.scriptureTitle) }, question));
    }
    router.push('/ask/confirm');
  };

  const handleCancelFollowup = () => setConfirmCancelModal(true);
  const confirmCancel = () => {
    setParentId(null);
    setQuestion('');
    setPreviousQA(null);
    setConfirmCancelModal(false);
    router.replace('/ask');
  };

  return (
    <>
          <main className="relative min-h-screen w-full max-w-[460px] flex flex-col justify-start items-center bg-surface-elevated px-6 py-6">
       
       
       
        <div className="w-full z-1">
          <h2 className="text-4xl text-accent font-semibold text-start">
            부처님의 지혜에<br />귀를 기울여 보세요
          </h2>
          <p className="text-base text-accent font-medium text-start mt-2">
            무엇이든 여쭈어 보세요.<br />부처님께서 답하십니다.
          </p>
        </div>

        {previousQA && (
          <div className="w-full bg-surface-elevated border border-line p-4 mt-6 mb-4 rounded-xl text-sm">
            <p className="text-ink-subtle font-medium mb-1">📌 이전 질문</p>
            <p className="text-ink font-semibold mb-2 whitespace-pre-wrap">{previousQA.question}</p>
            <p className="text-ink-subtle font-medium mb-1">🪷 부처님의 응답</p>
            <p className="text-ink italic whitespace-pre-wrap">{previousQA.answer}</p>
            <button
              onClick={handleCancelFollowup}
              className="text-sm text-accent mt-2 float-right"
            >
              이전 질문 삭제
            </button>
          </div>
        )}

        <div className="w-full h-16 bg-accent-soft rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
          <Image src="/lotusbeige.png" alt="lotus" width={48} height={48} className="object-contain border-on-brand mx-2" />
          <div className="flex flex-col">
            <p className="text-base font-base text-on-brand text-start">
              한 자 한 자 마음을 담아 적어보세요.<br />
              말씀이 깊을수록, 깨달음도 또렷해집니다.
            </p>
          </div>
        </div>
        <div className="max-w-md w-full z-1 mt-4">
  <div className="flex items-center justify-start mb-2">
    <span className="font-bold text-base mr-2 my-2">예시 질문 보기</span>
    <button
      onClick={() => setShowExamples((prev) => !prev)}
      className="flex items-center text-sm text-accent hover:underline"
    >
      {showExamples ? '숨기기' : '펼쳐보기'}
      <svg
        className={`ml-1 w-4 h-4 transition-transform duration-300 ${showExamples ? 'rotate-180' : 'rotate-0'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  {showExamples && (
  <ul className="list-disc list-outside space-y-2 mx-4 mb-4 text-sm text-ink-muted whitespace-pre-line">
    {exampleQuestions.map((ex, i) => (
      <li
      key={i}
      onClick={() => {
        setQuestion(ex);
        setShowExamples(false); // ✅ 여기 추가
      }}
          
        className="cursor-pointer hover:text-accent hover:underline"
      >
        {ex}
      </li>
    ))}
  </ul>
)}
</div>

        {citation && (
          <div className="w-full bg-surface-sunken border border-accent-soft/30 p-4 mt-4 rounded-xl text-sm relative">
            <button
              type="button"
              onClick={() => setCitation(null)}
              aria-label="인용 제거"
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-ink-subtle hover:bg-surface-elevated transition-colors"
            >
              <X size={16} />
            </button>
            <p className="text-ink-subtle font-medium mb-1">📖 경전 인용</p>
            <p className="text-xs text-ink-subtle mb-2 truncate pr-8">
              {formatScriptureTitle(citation.scriptureTitle)}
            </p>
            <p className="text-ink whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {citation.text}
            </p>
          </div>
        )}

        <div className="max-w-md w-full z-1 mt-2">
          <textarea
            className="w-full h-40 p-4 text-ink rounded-xl border border-accent-soft bg-surface-elevated text-base resize-none focus:outline-none focus:ring-2 focus:ring-red"
            rows={5}
            value={question}
            onChange={(e) => {
              e.preventDefault();
              setQuestion(e.target.value);
            }}
            onBlur={(e) => {
              // 포커스를 잃어도 현재 값을 유지
              const currentValue = e.target.value;
              if (currentValue !== question) {
                setQuestion(currentValue);
              }
            }}
            placeholder={
              citation
                ? '이 구절에 대해 더 묻고 싶은 점을 적어보세요. (비워두면 자동으로 의미를 여쭙습니다.)'
                : '마음을 담아 부처님께 여쭈고 싶은 이야기를 적어보세요'
            }
          />
          <button
            onClick={() => setQuestion('')}
            className="text-sm text-accent mt-0 float-right"
          >
            작성 내용 삭제
          </button>
</div>
<div className="max-w-md w-full z-1 mt-4">
  {/* 토글형 히스토리 */}
  <div className="flex items-center justify-start mb-2">
    <span className="font-bold text-base mr-2">내가 보관한 문답 보기</span>
    <button
      onClick={() => setShowSaved((prev) => !prev)}
      className="flex items-center text-sm text-accent hover:underline"
    >
      {showSaved ? '숨기기' : '펼쳐보기'}
      <svg
        className={`ml-1 w-4 h-4 transition-transform duration-300 ${showSaved ? 'rotate-180' : 'rotate-0'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  {showSaved && (
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex space-x-4">
            {user ? (
              savedAnswers.length > 0 ? (
                savedAnswers.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="min-w-[300px] bg-surface-elevated p-4 rounded-xl border shadow cursor-pointer"
                  >
                    <p className="text-sm text-ink-subtle mb-2">{new Date(item.created_at).toLocaleDateString()}</p>
                    <p className="text-sm font-semibold text-accent mb-1">📜 나의 질문</p>
                    <p className="text-sm text-ink line-clamp-2 mb-2">{item.question}</p>
                    <p className="text-sm font-semibold text-accent mb-1">🪷 부처님 말씀</p>
                    <p className="text-sm text-ink line-clamp-4">{item.answer}</p>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink-subtle">저장된 문답이 없습니다.</div>
              )
            ) : (
              <div className="min-w-[300px] py-4 rounded-xl shadow text-start text-sm text-ink-muted">
                <span>
                  <button
                    onClick={() => router.push('/login')}
                    className="text-accent underline hover:text-accent"
                  >
                    로그인
                  </button>
                  하고 저장된 문답을 확인해보세요.
                </span>
              </div>
            )}

            {user && savedAnswers.length >= 5 && (
              <div
                onClick={() => router.push('/me/answers')}
                className="min-w-[120px] flex justify-center items-center text-accent border border-dashed border-accent rounded-xl text-sm cursor-pointer hover:bg-accent-soft hover:text-on-brand"
              >
                더 보기 →
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-2xl shadow-xl max-w-md w-full max-h-[75vh] overflow-y-auto p-6 relative"
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-3 right-4 text-ink-subtle hover:text-ink text-xl"
            >×</button>
            <p className="text-sm text-ink-subtle text-right mb-2">
              {new Date(selectedItem.created_at).toLocaleDateString()}
            </p>
            <p className="text-base font-semibold text-accent mb-1">📜 나의 질문</p>
            <p className="text-base text-ink mb-4 whitespace-pre-line">
              「{selectedItem.question}」
            </p>
            <p className="text-base font-semibold text-accent mb-1">🪷 부처님 말씀</p>
            <p className="text-base text-ink whitespace-pre-line">
              {selectedItem.answer}
            </p>
            <button
              onClick={() => {
                setParentId(selectedItem.id);
                setSelectedItem(null);
                router.push('/ask');
              }}
              className="w-full mt-4 py-3 border bg-accent-soft border-accent text-on-brand font-bold rounded-4xl hover:bg-accent hover:text-on-brand transition"
            >
              문답을 이어갑니다
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              className="w-full mt-4 py-3 border border-accent-soft text-ink-muted font-bold rounded-4xl hover:bg-accent hover:text-on-brand transition"
            >
              닫기
            </button>

          </div>
        </div>
      )}
          {/* <div className="mt-8 mb-6">
            <p className="font-bold text-base mb-2">부처님의 지혜를 빌려올 원천을 선택하세요(QA용)</p>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedModel === model.id
                      ? 'border border-accent bg-accent-soft text-on-brand'
                      : 'border border-accent bg-surface-elevated text-ink'
                  }`}
                >
                  <div className="font-bold">{model.name}</div>
                  <div className="text-sm mt-1">{model.description}</div>
                </div>
              ))}
            </div>
          </div> */}

          <div className="mt-6 mb-6">
            <p className="font-bold mb-2">답변 길이 선택</p>
            <div className="grid grid-cols-2 gap-2">
              {lengths.map((length) => (
                <div
                  key={length.id}
                  onClick={() => setSelectedLength(length.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                    selectedLength === length.id
                      ? 'border border-accent bg-accent-soft text-on-brand'
                      : 'border border-accent bg-surface-elevated text-ink'
                  }`}
                >
                  <div className="font-bold">{length.name}</div>
                  <div className="text-sm mt-1">{length.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          className="mt-2 w-full px-6 py-3 font-bold bg-accent-soft text-lg text-on-brand rounded-4xl hover:bg-accent transition"
          onClick={handleNext}
          disabled={!question.trim()}
        >
          제출하기
        </button>

        <button
          onClick={() => setShowGuideModal(true)}
          className="text-sm text-ink underline mt-4 mb-8"
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
            className="bg-surface-elevated rounded-xl p-6 w-[90%] max-w-[360px] text-center shadow-xl"
          >
            <p className="text-lg font-semibold text-accent mb-4">정말 추가 질문을 취소할까요?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmCancelModal(false)}
                className="px-4 py-2 border rounded-lg text-sm text-ink-muted"
              >
                아니오
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-accent-soft text-on-brand rounded-lg text-sm"
              >
                네, 취소할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-xl p-6 w-[90%] max-w-[360px] text-start shadow-xl"
          >
            <h3 className="text-lg font-bold text-accent mb-4">사용 방법 안내</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-ink">
              <li>🪷 마음속 고민이나 질문을 자유롭게 입력하세요.</li>
              <li>❓ 물음이 상세할수록 더 깊은 답변을 들으실 수 있습니다.</li>
              <li>📜 부처님의 말씀과 함께 인용된 경전도 함께 확인할 수 있습니다.</li>
              <li>➕ &apos;문답을 이어갑니다&apos;로 후속 질문도 가능합니다.</li>
              <li>🔒 다른 이용자에게 나의 질문은 절대 공개되지 않습니다.</li>
            </ul>
            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full mt-6 py-2 bg-accent-soft text-on-brand rounded-lg hover:bg-accent transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
