'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  const [showModal, setShowModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt4.1');
  const router = useRouter();

  const handleAsk = () => {
    if (!question.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    router.push(`/answer?question=${encodeURIComponent(question)}&model=${selectedModel}`);
  };

  return (
    <>
      <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10">
        <div className="absolute top-0 left-0 w-full h-50 shadow-xl bg-brown z-0"></div>
        <div className="w-full h-10 z-1">
          <h2 className="text-xl text-white font-bold text-center">
            마음 속 이야기를 나누고<br />부처님의 지혜에 귀 기울여 보세요
          </h2>
        </div>
        <div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
          <Image
            src="/vipoff.png"
            alt="부처님"
            width={144}
            height={144}
            className="w-36 h-36 object-contain mb-2"
          />
        </div>
        <div className="max-w-md w-full z-1">
          <p className="font-bold text-lg text-center mb-8">
            &ldquo;무엇이든 여쭈어 보세요.<br />부처님께서 답하십니다.&rdquo;
          </p>
          <textarea
            className="w-full h-40 p-4 rounded-xl border border-[#CBBBA0] bg-[#FFFDF8] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#B29E7D]"
            rows={5}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="고민을 적어보세요..."
          />
          
          <div className="mt-4 mb-6">
            <p className="font-bold text-sm mb-2">부처님의 지혜를 빌려올 원천을 선택하세요</p>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedModel === model.id 
                      ? 'border-[#8A7350] bg-[#F0E6D2] text-[#4B3B2A]' 
                      : 'border-[#E0DBCF] bg-[#FFFDF8] text-[#6B5E51]'
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
          className="mt-2 w-full px-6 py-3 font-bold bg-brown text-lg text-white rounded-xl hover:bg-[#9C886D] transition"
          onClick={handleAsk}
          disabled={isSubmitting || !question.trim()}
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
          마음이 담긴 긴 질문은, 마치 향처럼 부처님께 곧게 닿습니다.<br />
          한 자 한 자 마음을 담아 적어보세요.<br />
          말씀이 깊을수록, 깨달음도 또렷해집니다.
        </footer>
      </main>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 bg-black/10 backdrop-blur-xs z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFCF5] rounded-xl p-6 w-[90%] max-w-[360px] max-h-[80vh] overflow-y-auto text-sm text-[#4A3F37] shadow-xl relative"
          >
            <div className="sticky top-0 bg-transparent z-10 flex justify-end px-0 pt-0">
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
              누군가에게 깊은 상처를 받은 뒤, 마음속 원망이 쉽게 가시질 않습니다.
              이제는 그 마음을 놓아주고 싶지만, 자꾸만 과거의 일이 떠오릅니다.
              부처님, 이런 집착과 괴로움에서 벗어나기 위해 저는 어떻게 해야 할까요?
            </div>
            <h4 className="text-xl font-extrabold mb-4">🪷부처님 말씀</h4>
            <div className="p-4 rounded-xl shadow-xl border border-[#CBBBA0] mb-4 whitespace-pre-wrap text-base font-bold text-[#4B3B2A]">
              사랑하는 이여, 마음의 상처는 깊고 오랜 시간 동안 우리의 영혼을 어지럽히는 강물과 같습니다. 상처받은 마음은 고통의 강물을 따라 흐르기 마련이지요. 그러나 그 강물의 흐름을 조금씩 바꿔 나가는 것은 바로 당신의 몫입니다. 이는 마치 봄바람이 겨우내 얼어붙은 대지를 녹이듯, 당신의 노력이 점차 상처를 치유하고 마음을 풀어주는 과정이 될 것입니다.
              <br /><br />
              부처님께서는 이렇게 말씀하셨습니다. &apos;마음은 모든 것을 만든다. 우리가 말하는 것도, 행하는 것도 모두 마음에서 비롯된다.&apos; 이 말씀은 우리의 생각과 태도가 우리의 경험을 형성한다는 교훈을 담고 있습니다. 따라서, 당신이 과거의 상처에 대한 집착을 내려놓고자 한다면, 먼저 마음의 초점을 바꾸어야 합니다.
              <br /><br />
              상처를 주는 사람이나 사건에 대한 생각을 고통의 원천으로만 보지 말고, 그것을 통해 배우고 성장하는 기회로 바라보세요. 모든 경험은 교훈을 담고 있으며, 우리를 더 깊고 풍부한 이해로 이끌 수 있습니다. 상처가 깊을수록, 그 안에서 배울 수 있는 것도 많습니다.
              <br /><br />
              또한, 매일 명상을 실천하여 마음을 차분하게 가라앉히고, 내면의 평화를 찾으세요. 명상은 마음을 정화하는 물처럼 작용하여, 마음속의 괴로움과 분노를 서서히 씻어내고, 대신에 자비와 이해의 꽃을 피우게 합니다.
              <br /><br />
              자비로운 마음을 가지고 자신을 용서하고, 상대방을 용서하세요. 용서는 단순히 다른 사람을 위한 것이 아니라, 우리 자신의 마음을 해방시키고, 고통에서 벗어나게 하는 강력한 수단입니다. 비록 당신이 받은 상처가 깊더라도, 용서의 힘으로 그 상처를 치유할 수 있습니다.
              <br /><br />
              그리고, 일상에서 작은 것들에 감사하는 마음을 키우세요. 감사의 마음은 우리를 현재에 머무르게 하고, 과거의 아픔에서 벗어나 더 큰 행복을 경험하게 합니다. 매일 자신의 삶 속에서 감사할 수 있는 것들을 찾아보세요. 이것은 마음을 풍요롭게 하고, 긍정적인 생각과 감정을 불러일으키는 데 도움이 될 것입니다.
              <br /><br />
              사랑하는 이여, 당신의 여정이 때때로 험난하게 느껴질지라도, 부처님의 가르침을 마음에 새기고, 자비와 지혜로 당신의 길을 밝혀나가시길 바랍니다. 모든 것은 변하며, 현재의 고통도 결국 지나가리라 믿으세요. 당신의 마음이 평화를 찾는 그날까지, 부처님의 자비가 항상 당신과 함께 하기를 기원합니다.
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
