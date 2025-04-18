'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '../../../../components/BottomNav';
import { useAskStore } from '../../../stores/askStore';

export default function ConfirmPage() {
  const router = useRouter();
  const { question } = useAskStore();

  const handleBack = () => {
    router.push('/ask');
  };

  const handleSubmit = () => {
    router.push('/answer');
  };

  return (
    <>
      <BottomNav />
      <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
        <div className="w-full z-1 pt-12">
          <h2 className="text-3xl text-red font-semibold text-start mb-4">
            부처님께 여쭈기 전,
            <br />마음을 다시 한번 바라보세요
          </h2>
          <p className="text-base text-red font-medium text-start mb-6">
            작성한 내용을 확인하시고, <br />준비되셨다면 마음을 전해 보세요.
          </p>
        </div>

        <div className="min-h-[12rem] w-full bg-[#FFFDF8] border border-red-light rounded-xl p-4 text-base text-gray-700 whitespace-pre-wrap mb-4">
          {question}
        </div>

        <div className="flex flex-row w-full space-x-6 mb-12">
          <button
            onClick={handleBack}
            className="w-full px-1 py-2 font-bold border border-red bg-white text-lg text-red-dark rounded-4xl hover:bg-red hover:text-white transition"
          >
            수정하기
          </button>

          <button
            onClick={handleSubmit}
            className="w-full px-1 py-2 font-bold bg-red-light text-lg text-white rounded-4xl hover:bg-red transition"
          >
            제출하기
          </button>
        </div>
      </main>
    </>
  );
}
