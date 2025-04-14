'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function AnswerContent() {
  const params = useSearchParams();
  const question = params?.get('question') || '';
  const answer = params?.get('answer') || '';
  const router = useRouter();

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10">
      <div className="absolute top-0 left-0 w-full h-50 bg-brown z-0"></div>

      <div className="w-full h-10 z-1">
        <h2 className="text-xl text-white font-bold text-center">
          부처님이라면 분명<br />
          이렇게 말씀하셨을 것입니다
        </h2>
      </div>

      <div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
        <img
          src="/vipon.png"
          alt="부처님"
          className="w-36 h-36 object-contain mb-2"
        />
      </div>

      <div className="max-w-md w-full">
        <h3 className="text-xl font-bold text-[#4B3B2A] mb-4"></h3>
        <div className="p-4 rounded border border-[#CBBBA0] mb-6 whitespace-pre-wrap text-base font-bold text-[#4B3B2A]">
          {answer}
        </div>
        <h2 className="text-l font-bold text-[#4B3B2A] mb-4">나의 질문</h2>
        <div className="p-4 rounded border border-[#CBBBA0] whitespace-pre-wrap text-[#4B3B2A] mb-4">
          {question}
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="mt-auto w-full py-2 bg-brown text-white rounded-xl font-semibold hover:bg-[#9C886D] transition"
      >
        처음으로
      </button>
    </main>
  );
}

export default function AnswerPage() {
  return (
    <Suspense fallback={<div className="p-4">로딩 중...</div>}>
      <AnswerContent />
    </Suspense>
  );
}


// 'use client';

// import { useSearchParams, useRouter } from 'next/navigation';

// export default function AnswerPage() {
//     const params = useSearchParams();
//     const question = params?.get('question') || '';
//     const answer = params?.get('answer') || '';
//   const router = useRouter();

//   return (
// <main className="relative min-h-screen flex flex-col items-center bg-[#F5F1E6] px-6 py-10">
//   <div className="absolute top-0 left-0 w-full h-50 bg-brown z-0"></div>
//   <div className="w-full h-10 z-1">      
//   <h2 className="text-xl text-white font-bold text-center">부처님이라면 분명<br></br>
// 이렇게 말씀하셨을 것입니다</h2>
// </div>
// <div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
// <img
//     src="/vipon.png"
//     alt="부처님"
//     className="w-36 h-36 object-contain mb-2"
//   />  
// </div>
//       <div className="max-w-md w-full">
//       <h3 className="text-xl font-bold text-[#4B3B2A] mb-4"></h3>
//         <div className="p-4 rounded border border-[#CBBBA0] mb-6 whitespace-pre-wrap text-base font-bold text-[#4B3B2A]">
//           {answer}
//         </div>
//         <h2 className="text-l font-bold text-[#4B3B2A] mb-4">나의 질문</h2>
//         <div className="p-4 rounded border border-[#CBBBA0] whitespace-pre-wrap text-[#4B3B2A] mb-4">
//           {question}
//         </div>
       
       
//       </div>
//       <button
//           onClick={() => router.push('/')}
//           className="mt-auto w-full py-2 bg-brown text-white rounded-xl font-semibold hover:bg-[#9C886D] transition"
//         >
//           처음으로
//         </button>
//     </main>
//   );
// }
