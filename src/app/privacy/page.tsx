export default function PrivacyPolicyPage() {
    return (
      <main className="p-6 max-w-[600px] mx-auto text-sm leading-relaxed text-gray-800 bg-white">
        <h1 className="text-xl font-bold mb-4">📜 개인정보 처리방침</h1>
  
        <p className="mb-4">
          「연등」(이하 ‘서비스’)는 이용자의 개인정보를 소중하게 생각하며, 아래와 같은 목적과 범위 내에서만 개인정보를 수집 및 이용합니다.
        </p>
  
        <h2 className="font-semibold mt-6 mb-2">1. 수집 항목</h2>
        <ul className="list-disc list-inside mb-4">
          <li>이름</li>
          <li>생년월일</li>
          <li>이메일 (소셜 로그인 계정)</li>
          <li>알림 수신 여부</li>
        </ul>
  
        <h2 className="font-semibold mt-6 mb-2">2. 수집 목적</h2>
        <ul className="list-disc list-inside mb-4">
          <li>본인 식별 및 서비스 이용 기록 관리</li>
          <li>맞춤형 기능 제공 및 통계 분석</li>
          <li>알림 및 공지사항 전달</li>
        </ul>
  
        <h2 className="font-semibold mt-6 mb-2">3. 보관 기간</h2>
        <p className="mb-4">
          개인정보는 이용자가 서비스에서 탈퇴하거나 삭제를 요청할 경우 즉시 파기되며, 관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안 보관 후 파기됩니다.
        </p>
  
        <h2 className="font-semibold mt-6 mb-2">4. 외부 제공</h2>
        <p className="mb-4">
          수집된 개인정보는 이용자의 명시적인 동의 없이 외부에 제공되지 않으며, 법령에 정해진 경우에 한해 제공될 수 있습니다.
        </p>
  
        <h2 className="font-semibold mt-6 mb-2">5. 개인정보 보호 책임자</h2>
        <p className="mb-8">
          문의 사항은 서비스 내 피드백 또는 이메일을 통해 접수해주시면 성실히 응답하겠습니다.
        </p>
  
        <p className="text-xs text-gray-500">
          본 방침은 {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일 기준으로 적용됩니다.
        </p>
      </main>
    );
  }
  