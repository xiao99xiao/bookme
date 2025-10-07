import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button as DSButton, Container } from "@/design-system";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { useReferralCode } from "@/hooks/useReferralCode";
import { cn } from "@/lib/utils";
import { Clock, MessageSquare, Paintbrush, Star, Video } from "lucide-react";

const ASSETS = {
  hero: "http://localhost:3845/assets/6fa4a9f571493739b6942cab9fafb4cf285e1a36.svg",
  swirl: "http://localhost:3845/assets/ef9b5a038c87196100f1cc38dbdc68e298528459.svg",
  mask: "http://localhost:3845/assets/96bdc66af043775be04edd2a4c4b76f8efc2477b.svg",
  corner: "http://localhost:3845/assets/e496a9c799dac7e010123b2253b256e9e55b5235.svg",
  zoom: "http://localhost:3845/assets/e57abbbbe95a9a200470f7dc5dcfe465fc9d9372.svg",
  googleMeet: "http://localhost:3845/assets/e32cc07d7710681bf79fdbe7f2acb0e735963894.svg",
  referral: {
    share: "http://localhost:3845/assets/1f392e44a9a4e96589cce8815484475149676b8a.svg",
    avatar: "http://localhost:3845/assets/3932a40f89f1ae48fc74414a7bd7c684158264f0.svg",
    sparkle: "http://localhost:3845/assets/abc76b157a8a05846d4bf9de6234e8775ee51c40.svg",
    orbit: "http://localhost:3845/assets/87c0687de291718af32babf6b0d5325cc26585e7.svg",
  },
  buttonTexture: "http://localhost:3845/assets/226049655f3871f3dac264b316138eae1882ff2f.png",
  escrow: {
    polygon1: "http://localhost:3845/assets/9727c6c0db8d2728de2bd64fa48154d3a0a11d24.svg",
    polygon2: "http://localhost:3845/assets/cfe63d2cb9a5b16d05fa75902b809dd0acc0ba2a.svg",
    subtract: "http://localhost:3845/assets/01eff22ddae77a1c4a4910995f0456b179e822df.svg",
    customerFace: "http://localhost:3845/assets/f91a925c9e686563778edc46f458dc0d1ad8e859.svg",
    providerFace: "http://localhost:3845/assets/668dcdb4ced234bc13bf8f4d5c6ab1f2b6bbc259.svg",
    arrow: "http://localhost:3845/assets/ca91b38255614e85368f674da70caf0044c7d5ba.svg",
    arrowLeft: "http://localhost:3845/assets/b506973101a0cb770dbc8a66d69dc0319dcba805.svg",
    arrowRight: "http://localhost:3845/assets/488b4871b42b2201adbc07de58fb3b78a0167e80.svg",
    coin1: "http://localhost:3845/assets/cc440749a64068a17c864240cea6acf8b84363a9.svg",
    coin2: "http://localhost:3845/assets/5c768fa3e797727ca221cb6d1e4e5d5d7b33b3bb.svg",
    coinStar: "http://localhost:3845/assets/11b5c3c4d795d673b09bd896acbb9c23914d3ed6.svg",
    coinDollar: "http://localhost:3845/assets/da176571b63a239e41bc3a646141cc7ebdecc469.svg",
    sparkle: "http://localhost:3845/assets/6083e47a190d89e484932bf358371b84baaae396.svg",
  },
};

const Index = () => {
  const { login } = useAuth();
  useReferralCode();

  return (
    <main className="relative overflow-hidden">
      <Hero onPrimaryClick={login} />
      <Highlights />
    </main>
  );
};

const Hero = ({ onPrimaryClick }: { onPrimaryClick: () => void }) => (
  <section className="relative px-6 pb-20 pt-20 sm:px-10 lg:px-[120px]">
    <HeroDecor />
    <div className="pointer-events-none absolute left-1/2 top-20 flex -translate-x-1/2 items-center justify-center overflow-hidden" style={{ width: '1200px', height: '336px' }}>
      <img
        src={ASSETS.hero}
        alt=""
        className="min-h-full min-w-full"
      />
    </div>
    <Container maxWidth="xl" className="relative z-10">
      <div className="flex flex-col items-center gap-10 pt-40 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="max-w-[720px] text-[48px] font-bold leading-[1.2] text-black">
            Get paid for your time.
          </h1>
          <p className="max-w-[540px] text-[18px] leading-[1.5] text-[#666666]">
            Share your skills or spare hours—earn safely with guaranteed payment.
          </p>
        </div>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <SecondaryCta to="/book-services">Looking for Services</SecondaryCta>
          <PrimaryCta onClick={onPrimaryClick}>Start Earning Today</PrimaryCta>
        </div>
      </div>
    </Container>
  </section>
);

const HeroDecor = () => (
  <>
    <img src={ASSETS.swirl} alt="" className="pointer-events-none absolute -left-[400px] top-[128px] hidden h-auto w-[468px] rotate-[210deg] opacity-60 lg:block" />
    <img src={ASSETS.mask} alt="" className="pointer-events-none absolute -right-[484px] top-[-401px] hidden h-auto w-[780px] opacity-70 lg:block" />
    <img src={ASSETS.corner} alt="" className="pointer-events-none absolute right-[29px] top-[405px] hidden h-auto w-[250px] rotate-90 opacity-80 lg:block" />
  </>
);

const PrimaryCta = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="relative w-[200px] shrink-0 overflow-hidden rounded-[40px] border border-solid border-white px-6 py-3 shadow-[0_0_40px_rgba(0,115,255,0.6)]"
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[40px]">
      <div className="absolute inset-0 rounded-[40px] bg-gradient-to-b from-[#0073ff] to-[#0da2ff]" />
      <div
        className="absolute inset-0 rounded-[40px] bg-repeat bg-[length:307.2px_307.2px] bg-left-top opacity-40"
        style={{ backgroundImage: `url('${ASSETS.buttonTexture}')` }}
      />
    </div>
    <p className="relative shrink-0 whitespace-nowrap font-['Inter'] text-[16px] font-semibold leading-[1.5] text-white">
      {children}
    </p>
    <div className="pointer-events-none absolute inset-0 shadow-[0px_1px_18px_2px_inset_#d2eaff,0px_1px_4px_2px_inset_#d2eaff]" />
  </button>
);

const SecondaryCta = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="flex w-[200px] items-center justify-center gap-2 rounded-[40px] border border-[#cccccc] border-solid px-6 py-3"
  >
    <p className="whitespace-nowrap font-['Inter'] text-[16px] font-semibold leading-[1.5] text-black">
      {children}
    </p>
  </Link>
);

const Highlights = () => (
  <section className="relative px-6 pb-20 pt-20 sm:px-10 lg:px-[120px]">
    <Container maxWidth="xl" className="relative z-10">
      <div className="mx-auto grid w-full max-w-[1200px] gap-6 lg:grid-cols-3">
        <YourOwnPageCard />
        <div className="flex flex-col gap-6">
          <GuaranteedByEscrowCard />
          <SyncsCard />
        </div>
        <div className="flex flex-col gap-6">
          <ReputationCard />
          <ReferralCard />
        </div>
      </div>
    </Container>
  </section>
);

const YourOwnPageCard = () => (
  <div className="h-[542px] rounded-[40px] bg-[#dcf3ff] p-8">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
        <Paintbrush className="h-5 w-5 text-black" />
      </div>
      <p className="text-[20px] font-bold leading-[1.4] text-black">Your own page</p>
    </div>
    <div className="mt-6 h-[422px] overflow-hidden rounded-[24px] bg-white p-8">
      <ProfileRow />
      <div className="mt-4 h-2 w-64 rounded-md bg-[#ebebeb]" />
      <div className="mt-2 h-2 w-44 rounded-md bg-[#ebebeb]" />
      <div className="mt-4 flex gap-1">
        <div className="h-8 w-8 rounded-full bg-[#ebebeb]" />
        <div className="h-8 w-8 rounded-full bg-[#ebebeb]" />
        <div className="h-8 w-8 rounded-full bg-[#ebebeb]" />
      </div>
      <div className="mt-6">
        <p className="text-[14px] font-medium text-[#666666]">Services</p>
        <div className="mt-2 rounded-2xl bg-[#fbfbfb] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-2 w-28 rounded-md bg-[#ebebeb]" />
              <div className="mt-2 h-2 w-20 rounded-md bg-[#ebebeb]" />
            </div>
            <div className="rounded-xl border border-[#ebebeb] bg-[#ebebeb] px-2 py-1 text-[14px] font-semibold text-black">Book</div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-[14px] font-medium text-[#666666]">Customer Review</p>
        <div className="mt-2 rounded-2xl bg-[#fbfbfb] p-4">
          <div className="h-2 w-20 rounded-md bg-[#ebebeb]" />
          <div className="mt-2 h-2 w-14 rounded-md bg-[#ebebeb]" />
          <div className="mt-2 flex items-center justify-end gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-[#ebebeb] text-[#ebebeb]" />
            ))}
            <span className="ml-1 text-[14px] font-medium text-black">4/5</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProfileRow = () => (
  <div className="flex items-center gap-4">
    <div className="h-16 w-16 shrink-0 rounded-full bg-[#ebebeb]" />
    <div className="flex-1 space-y-2">
      <div className="h-8 w-20 rounded-xl bg-[#ebebeb]" />
      <div className="h-4 w-12 rounded-md bg-[#ebebeb]" />
    </div>
    <div className="h-4 w-16 rounded-md bg-[#ebebeb]" />
  </div>
);

const GuaranteedByEscrowCard = () => (
  <div className="relative h-[296px] overflow-hidden rounded-[40px] bg-[#ffeda3] p-8">
    <div className="relative h-[232px] w-[320px] overflow-clip rounded-[24px] bg-white">
      {/* Left Coin Group */}
      <div className="pointer-events-none absolute" style={{ left: '18px', top: '29px' }}>
        <img src={ASSETS.escrow.coin1} alt="" className="absolute" style={{ left: '2px', top: '2px', width: '34px', height: '34px' }} />
        <img src={ASSETS.escrow.coin2} alt="" className="absolute" style={{ left: '0px', top: '0px', width: '33px', height: '33px' }} />
        <img src={ASSETS.escrow.coinStar} alt="" className="absolute" style={{ left: '4px', top: '4px', width: '24px', height: '24px', transform: 'rotate(30deg)' }} />
        <img src={ASSETS.escrow.sparkle} alt="" className="absolute" style={{ left: '33px', top: '-4px', width: '8px', height: '8px', transform: 'rotate(15deg)' }} />
      </div>

      {/* Right Coin Group */}
      <div className="pointer-events-none absolute" style={{ left: '264px', top: '25px' }}>
        <img src={ASSETS.escrow.coin1} alt="" className="absolute" style={{ left: '2px', top: '2px', width: '34px', height: '34px' }} />
        <img src={ASSETS.escrow.coin2} alt="" className="absolute" style={{ left: '0px', top: '0px', width: '33px', height: '33px' }} />
        <img src={ASSETS.escrow.coinDollar} alt="" className="absolute" style={{ left: '4px', top: '4px', width: '24px', height: '24px' }} />
        <img src={ASSETS.escrow.sparkle} alt="" className="absolute" style={{ left: '33px', top: '-4px', width: '8px', height: '8px', transform: 'rotate(15deg)' }} />
      </div>

      {/* House Icon - Center Top */}
      <div className="pointer-events-none absolute" style={{ left: '119px', top: '9px', width: '82px', height: '60px' }}>
        {/* Roof */}
        <img src={ASSETS.escrow.polygon1} alt="" className="absolute" style={{ left: '28px', top: '0px', width: '26px', height: '23px' }} />
        {/* Base */}
        <img src={ASSETS.escrow.polygon2} alt="" className="absolute" style={{ left: '15px', top: '13px', width: '52px', height: '32px' }} />
        {/* Door */}
        <div className="absolute bg-[#8d5517]" style={{ left: '31px', top: '36px', width: '20px', height: '24px', borderRadius: '3px 3px 0 0' }} />
        {/* Decorative dots */}
        <div className="absolute size-[4px] rounded-full bg-[#95ceff]" style={{ left: '12px', top: '31px' }} />
        <div className="absolute size-[3px] rounded-full bg-[#ff81d1]" style={{ left: '0px', top: '11px' }} />
        <div className="absolute h-[8px] w-[4px] rounded-full bg-[#a6d803]" style={{ left: '60px', top: '3px', transform: 'rotate(50deg)' }} />
        <div className="absolute h-[8px] w-[4px] rounded-full bg-[#ff81d1]" style={{ left: '72px', top: '14px', transform: 'rotate(30deg)' }} />
        <div className="absolute h-[8px] w-[4px] rounded-full bg-[#95ceff]" style={{ left: '12px', top: '-2px', transform: 'rotate(-30deg)' }} />
      </div>

      {/* Customer Face - Bottom Left */}
      <img src={ASSETS.escrow.customerFace} alt="" className="pointer-events-none absolute" style={{ left: '37px', top: '157px', width: '50px', height: '50px' }} />

      {/* Provider Face - Bottom Right */}
      <img src={ASSETS.escrow.providerFace} alt="" className="pointer-events-none absolute" style={{ left: '233px', top: '142px', width: '54px', height: '60px' }} />

      {/* Video Camera Icon - Center Bottom */}
      <div className="pointer-events-none absolute" style={{ left: '154px', top: '206px', width: '36px', height: '24px' }}>
        <div className="absolute h-[20px] w-[24px] rounded-[6px] bg-[#a6d803]" style={{ left: '0px', top: '2px' }} />
        <img src={ASSETS.escrow.subtract} alt="" className="absolute" style={{ left: '26px', top: '4px', width: '9px', height: '13px' }} />
      </div>

      {/* Arrows - curved paths connecting elements */}
      {/* Arrow from customer to house */}
      <img src={ASSETS.escrow.arrowLeft} alt="" className="pointer-events-none absolute" style={{ left: '28px', top: '61px', width: '63px', height: '20px', transform: 'rotate(135deg)' }} />

      {/* Arrow from house to provider */}
      <img src={ASSETS.escrow.arrowRight} alt="" className="pointer-events-none absolute" style={{ left: '226px', top: '61px', width: '63px', height: '20px', transform: 'rotate(210deg)' }} />

      {/* Arrow from customer to provider (bottom) */}
      <img src={ASSETS.escrow.arrow} alt="" className="pointer-events-none absolute" style={{ left: '139px', top: '170px', width: '63px', height: '20px' }} />

      {/* Text Labels */}
      <p className="absolute whitespace-nowrap font-['Inter'] text-[14px] font-extrabold leading-[1.5] text-[#44beff]" style={{ left: '38px', top: '213px' }}>
        customer
      </p>
      <p className="absolute whitespace-nowrap font-['Inter'] text-[14px] font-extrabold leading-[1.5] text-[#eeb737]" style={{ left: '234px', top: '209px' }}>
        provider
      </p>

      {/* Title */}
      <p className="absolute left-1/2 top-[116px] -translate-x-1/2 whitespace-nowrap font-['Inter'] text-[20px] font-bold leading-[1.4] text-black">
        Guaranteed by escrow
      </p>
    </div>
  </div>
);

const SyncsCard = () => (
  <div className="relative h-[222px] overflow-hidden rounded-[40px] bg-[#f2f2f2] p-8">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
        <Clock className="h-5 w-5 text-black" />
      </div>
      <div className="text-[20px] font-bold leading-[1.4] text-black">
        <p className="mb-0">Syncs with Zoom &</p>
        <p>Google Calendar</p>
      </div>
    </div>
    <img
      src={ASSETS.zoom}
      alt="Zoom"
      className="absolute -right-1.5 -top-0.5 h-14 w-14 rotate-[345deg]"
    />
    <img
      src={ASSETS.googleMeet}
      alt="Google Meet"
      className="absolute bottom-8 left-6 h-14 w-14 rotate-[345deg]"
    />
  </div>
);

const ReputationCard = () => (
  <div className="rounded-[40px] bg-[#eaffa3] p-8">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
        <MessageSquare className="h-5 w-5 text-black" />
      </div>
      <p className="text-[20px] font-bold leading-[1.4] text-black">Build your reputation</p>
    </div>
    <div className="mt-4 rounded-2xl border border-white bg-white p-4">
      <p className="text-[14px] font-semibold leading-[1.5] text-black">
        " I really enjoyed the online English class. The atmosphere was supportive, and I learned useful expressions that I can use in daily life."
      </p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-[14px] font-semibold text-[#666666]">-- Taylor</p>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-[#fbbf24] text-[#fbbf24]" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ReferralCard = () => (
  <div className="relative h-[271px] overflow-hidden rounded-[40px] bg-[#ffe9fb] p-8">
    {/* White blob background */}
    <img
      src={ASSETS.referral.share}
      alt=""
      className="pointer-events-none absolute right-4 top-6 h-[209px] w-[188px]"
    />

    {/* Gift image container - positioned left, vertically centered */}
    <div className="pointer-events-none absolute left-6 top-1/2 h-[144px] w-[144px] -translate-y-1/2 overflow-clip">
      {/* Sparkle - Group 30 (bottom) */}
      <img
        src={ASSETS.referral.avatar}
        alt=""
        className="absolute z-10 h-[49px] w-[79px] rotate-[345deg]"
        style={{ left: '20px', top: '25px' }}
      />
      {/* Gift box - middle layer */}
      <img
        src={ASSETS.referral.sparkle}
        alt=""
        className="absolute z-20 h-[52px] w-[67px]"
        style={{ left: '42px', top: '92px' }}
      />
      {/* Confetti/orbit - Group 32 (top) */}
      <img
        src={ASSETS.referral.orbit}
        alt=""
        className="absolute z-30 h-[103px] w-[136px] rotate-[345deg]"
        style={{ left: '-11.57px', top: '-14.35px' }}
      />
    </div>

    <div className="relative z-10 flex h-full flex-col justify-end">
      <div className="text-right">
        <p className="text-[40px] font-bold leading-[1.5] tracking-[-1.2px] text-black" style={{ fontFamily: "'Baloo 2', sans-serif" }}>Earn 5%</p>
        <p className="text-[18px] font-bold leading-[1.5] text-black">from every</p>
        <p className="text-[18px] font-bold leading-[1.5] text-black">invite's income</p>
      </div>
      <p className="mt-4 w-full text-[14px] font-extrabold text-[#ea6177]">* without affecting their payout.</p>
    </div>
  </div>
);

export default Index;
