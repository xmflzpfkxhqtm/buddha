// 개인정보 처리방침. Flutter 앱(oginc-moe/yeondeung_app `privacy_policy_view.dart`)과
// 같은 내용이며, 웹에서만 다른 점(로그인 없는 질문, Vercel 서버)을 함께 적는다.
// 스토어에 등록된 방침 URL이 이 페이지이므로, 내용을 바꾸면 앱 쪽과 시행일도 함께 고친다.

const EFFECTIVE_DATE = '2026년 11월 22일';
const OFFICER_NAME = '이홍인';
const OFFICER_EMAIL = 'snusm108@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="font-semibold mt-6 mb-2">{title}</h2>
      {children}
    </>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="p-6 max-w-[600px] mx-auto text-sm leading-relaxed text-ink bg-surface-elevated">
      <h1 className="text-xl font-bold mb-4">📜 개인정보 처리방침</h1>

      <p className="mb-4">
        「연등」(이하 ‘서비스’)는 이용자의 개인정보를 소중하게 생각하며, 아래와 같은 목적과 범위 내에서만 개인정보를 처리합니다.
      </p>

      <Section title="1. 처리하는 항목">
        <ul className="list-disc list-inside mb-2">
          <li>로그인: 소셜 로그인(Google, 카카오, Apple) 계정의 이메일과 계정 식별자</li>
          <li>프로필: 이름, 생년월일, 알림 수신 여부</li>
          <li>서비스 이용 기록: 질문과 답변, 하이라이트와 메모, 즐겨찾기, 사경 진행 위치와 완성한 사경 이미지, 제안 및 문의 내용</li>
        </ul>
        <p className="mb-4">
          앱에서 ‘묻기’는 로그인한 이용자만 사용할 수 있습니다. 웹에서는 로그인하지 않고도 질문할 수 있으며, 이때는 계정 정보 없이 질문과 답변만 저장됩니다.
        </p>
      </Section>

      <Section title="2. 처리 목적">
        <ul className="list-disc list-inside mb-4">
          <li>본인 식별과 로그인 유지</li>
          <li>질문에 대한 답변 생성과 답변 공유</li>
          <li>하이라이트, 즐겨찾기, 사경 등 이용 기록의 저장과 표시</li>
          <li>제안 및 문의 응대</li>
          <li>알림 및 공지사항 전달(알림 수신에 동의한 경우)</li>
        </ul>
      </Section>

      <Section title="3. 외부 AI 서비스로의 전송">
        <p className="mb-4">
          ‘묻기’에 입력한 질문 내용은 답변을 만들기 위해 OpenAI(미국)의 AI 모델로 전송됩니다. 질문에 이름, 연락처 등 다른 사람이 나를 알아볼 수 있는 정보는 적지 마십시오.
        </p>
        <p className="mb-4">
          질문과 답변은 답변을 다시 보고 공유하는 기능을 위해 서버에 저장되며, 공유 링크를 받은 사람은 그 내용을 볼 수 있습니다.
        </p>
      </Section>

      <Section title="4. 처리 위탁과 국외 이전">
        <p className="mb-2">서비스는 다음 업체에 개인정보 처리를 맡깁니다.</p>
        <ul className="list-disc list-inside mb-2">
          <li>Supabase Inc.: 회원 정보와 이용 기록 저장(서버 위치: 대한민국 서울), 앱의 질문 전달</li>
          <li>Vercel Inc.(미국): 웹 서비스 운영, 웹의 질문 전달과 회원 탈퇴 요청 전달</li>
          <li>OpenAI, L.L.C.(미국): 질문에 대한 답변 생성</li>
        </ul>
        <p className="mb-4">
          미국으로 이전되는 정보는 질문 내용과 처리에 필요한 요청 정보이며, 질문할 때마다 네트워크를 통해 전송됩니다. 이전을 원하지 않으면 ‘묻기’ 기능을 사용하지 않으면 됩니다.
        </p>
      </Section>

      <Section title="5. 제3자 제공">
        <p className="mb-4">
          위 처리 위탁 외에는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않으며, 법령에 정해진 경우에 한해 제공할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 보관 기간과 파기">
        <p className="mb-4">
          개인정보는 이용자가 탈퇴하면 지체 없이 파기합니다. 관련 법령에 따라 보관이 필요한 경우에는 해당 기간 동안 보관한 뒤 파기합니다.
        </p>
      </Section>

      <Section title="7. 이용자의 권리">
        <p className="mb-4">
          이용자는 ‘내 정보 → 프로필 관리’에서 자신의 정보를 확인하고 고칠 수 있으며, 같은 화면의 ‘계정 삭제 요청하기’에서 계정과 이용 기록을 삭제할 수 있습니다. 하이라이트, 저장한 답변, 사경노트는 각 목록에서 개별로 삭제할 수 있습니다. 그 밖의 열람, 정정, 삭제, 처리 정지 요청은 아래 이메일로 받습니다.
        </p>
      </Section>

      <Section title="8. 개인정보 보호 책임자">
        <p className="mb-8">
          문의 사항은 서비스 내 ‘제안 및 문의 보내기’ 또는 이메일로 접수해 주시면 성실히 응답하겠습니다.
          <br />
          책임자: {OFFICER_NAME}
          <br />
          이메일: {OFFICER_EMAIL}
        </p>
      </Section>

      <p className="text-xs text-ink-subtle">본 방침은 {EFFECTIVE_DATE}부터 적용됩니다.</p>
    </main>
  );
}
