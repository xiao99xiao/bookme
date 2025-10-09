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
  andMore: {
    check: "http://localhost:3845/assets/b6a1dd069303dc19de38b163027941400ec0c083.svg",
    laptop: "http://localhost:3845/assets/f0d4007f94a2f1f8c2c9915368f69464c2c733cf.svg",
    calendar: "http://localhost:3845/assets/26d82e6dd446cf9a321bd786c465634fab030b7a.svg",
    line: "http://localhost:3845/assets/1af9a0add2a2994f4076bbc6f27747a78786f83c.svg",
    googleMeet: "http://localhost:3845/assets/9661df557f27fdc267cc0621f641e5673542f88a.svg",
    homeAlt: "http://localhost:3845/assets/d2482277759d5ce494d2c18083074c0e5bd345b0.svg",
    leftChar: "http://localhost:3845/assets/d8a41e5fced525b248d7c8ff1d41d64ed7010325.svg",
    wallet: "http://localhost:3845/assets/409be5ba101830cb76a7b02a92d5c9d56f15109d.svg",
    rightChar: "http://localhost:3845/assets/653613b31c6958ca0a00cdf8abefd21ad09f9c72.svg",
    coin1: "http://localhost:3845/assets/10671ec77ca9ef8a96f9e57bcf6dc7d49b607a07.svg",
    coin1Inner1: "http://localhost:3845/assets/5fe911335bdbe72bd7182e6a2ce3c3e79711ff03.svg",
    coin1Inner2: "http://localhost:3845/assets/2b90f4c89f9e19b15c00802de35af2bb33edd058.svg",
    coin2: "http://localhost:3845/assets/1018bc703415c6612739295e3810552da047b2f7.svg",
    coin2Inner1: "http://localhost:3845/assets/bef45ed9987bf628d58f63dd153111bfc4b83256.svg",
    coin2Inner2: "http://localhost:3845/assets/fa9ee4d4b8dfbbddc0022c4cbf7ba5fe4e69a99c.svg",
  },
};

const Index = () => {
  const { login } = useAuth();
  useReferralCode();

  return (
    <main className="relative overflow-hidden">
      <Hero onPrimaryClick={login} />
      <Highlights />
      <AndMore />
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
    className="relative w-[200px] shrink-0 overflow-hidden rounded-[40px] px-6 py-3 shadow-[0_15px_40px_-10px_rgba(0,115,255,0.8)]"
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
    <div className="pointer-events-none absolute inset-0 rounded-[40px] opacity-80 shadow-[0px_1px_18px_4px_inset_#d2eaff]" />
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

const AndMore = () => (
  <section className="relative px-6 pb-20 pt-20 sm:px-10 lg:px-[120px] lg:pb-[80px] lg:pt-[80px]">
    <Container maxWidth="xl" className="relative z-10">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-16 text-center font-['Inter'] text-[48px] font-bold leading-[1.2] text-black">And more</h2>
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-[24px]">
          <TrackEarningsCard />
          <GetPaidUSDCCard />
          <ManageOrdersCard />
        </div>
      </div>
    </Container>
  </section>
);

const TrackEarningsCard = () => (
  <div className="flex min-h-px min-w-px flex-1 flex-col items-start rounded-tl-[24px] rounded-tr-[24px] rounded-bl-[40px] rounded-br-[40px] bg-[#fafafa]">
    <div className="flex w-full flex-col gap-[16px] p-[32px]">
      <p className="font-['Inter'] text-[20px] font-bold leading-[1.4] text-black">Track your earnings</p>
      <p className="font-['Inter'] text-[16px] font-normal leading-[1.5] text-[#666666]">
        Timee takes care of everything else — secure payments, effortless booking, and the right users who value your time.
      </p>
    </div>
    <div className="relative size-[384px] shrink-0 overflow-hidden rounded-[40px] bg-[#ffe9fb]">
      <div className="absolute left-[32px] top-[32px] flex w-[320px] flex-col gap-[16px]">
        {/* First earning card */}
        <div className="flex w-full flex-col gap-[16px] rounded-[16px] border border-white bg-white p-[16px]">
          <div className="flex w-full gap-[16px]">
            <div className="flex min-h-px min-w-px flex-1 flex-col gap-[4px]">
              <p className="font-['Inter'] text-[14px] font-normal leading-[1.5] text-[#666666]">Date</p>
              <div className="flex h-[32px] w-full items-center justify-center gap-[4px]">
                <p className="h-[21px] min-h-px min-w-px flex-1 font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">
                  Sep 15, 2025
                </p>
              </div>
            </div>
            <div className="flex min-h-px min-w-px flex-1 flex-col gap-[4px]">
              <p className="min-w-full font-['Inter'] text-[14px] font-normal leading-[1.5] text-[#666666]" style={{ width: 'min-content' }}>Type</p>
              <div className="flex h-[32px] items-center justify-center gap-[8px] rounded-[12px] border border-[#eff7ff] bg-[#eff7ff] px-[8px] py-[12px]">
                <p className="font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">Service</p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start leading-[1.5]">
            <p className="min-w-full font-['Inter'] text-[14px] font-normal text-[#666666]" style={{ width: 'min-content' }}>Amount</p>
            <p className="font-['Baloo_2'] text-[28px] font-extrabold text-black">+ $58.00</p>
          </div>
        </div>
        {/* Second earning card */}
        <div className="flex w-full flex-col gap-[16px] rounded-[16px] border border-white bg-white p-[16px]">
          <div className="flex w-full gap-[16px]">
            <div className="flex min-h-px min-w-px flex-1 flex-col gap-[4px]">
              <p className="font-['Inter'] text-[14px] font-normal leading-[1.5] text-[#666666]">Date</p>
              <div className="flex h-[32px] w-full items-center justify-center gap-[4px]">
                <p className="h-[21px] min-h-px min-w-px flex-1 font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">
                  Sep 12, 2025
                </p>
              </div>
            </div>
            <div className="flex min-h-px min-w-px flex-1 flex-col gap-[4px]">
              <p className="min-w-full font-['Inter'] text-[14px] font-normal leading-[1.5] text-[#666666]" style={{ width: 'min-content' }}>Type</p>
              <div className="flex h-[32px] items-center justify-center gap-[8px] rounded-[12px] border border-[#ffeff0] bg-[#ffeff0] px-[8px] py-[12px]">
                <p className="font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">Referral</p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start leading-[1.5]">
            <p className="min-w-full font-['Inter'] text-[14px] font-normal text-[#666666]" style={{ width: 'min-content' }}>Amount</p>
            <p className="font-['Baloo_2'] text-[28px] font-extrabold text-black">+ $6.00</p>
          </div>
        </div>
      </div>
      {/* Character illustration */}
      <div className="absolute left-[180px] top-[328px] h-[84px] w-[137px]">
        <div className="absolute inset-[-0.71%_-0.44%]">
          <img src={ASSETS.andMore.leftChar} alt="" className="block size-full max-w-none" />
        </div>
      </div>
    </div>
  </div>
);

const GetPaidUSDCCard = () => (
  <div className="flex min-h-px min-w-px flex-1 flex-col items-start rounded-tl-[24px] rounded-tr-[24px] rounded-bl-[40px] rounded-br-[40px] bg-[#fafafa]">
    <div className="flex w-full flex-col gap-[16px] items-center p-[32px]">
      <p className="w-full font-['Inter'] text-[20px] font-bold leading-[1.4] text-black">Get paid in USDC</p>
      <p className="w-full font-['Inter'] text-[16px] font-normal leading-[1.5] text-[#666666]">
        With transparent pricing and safe USDC payments, every effort you give turns directly into rewards you keep.
      </p>
    </div>
    <div className="relative h-[384px] w-full shrink-0 overflow-hidden rounded-[40px] bg-[#dcf3ff]">
      {/* Large coin - rotated with proper transform wrapper */}
      <div className="absolute left-[88px] top-[70.08px] flex items-center justify-center" style={{ height: 'calc(1px * ((104 * 0.258819043636322) + (104 * 0.9659258127212524)))', width: 'calc(1px * ((104 * 0.9659258127212524) + (104 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[345deg]">
          <div className="relative size-[104px] overflow-clip">
            <div className="absolute inset-0">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin1} />
            </div>
            <div className="absolute inset-[25.4%_36.25%_24.39%_35.81%]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin1Inner1} />
            </div>
            <div className="absolute inset-[14.57%_12.44%_13.32%_12.41%]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin1Inner2} />
            </div>
          </div>
        </div>
      </div>
      {/* Wallet */}
      <div className="absolute left-1/2 top-[147px] h-[209px] w-[240px] -translate-x-1/2">
        <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.wallet} />
      </div>
      {/* Character */}
      <div className="absolute right-[23.73px] top-[252px] h-[104px] w-[123.275px]">
        <div className="absolute bottom-[-0.58%] left-0 right-[-0.49%] top-[-0.58%]">
          <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.rightChar} />
        </div>
      </div>
      {/* Decorative elements - dots */}
      <div className="absolute left-[275px] top-[126.97px] flex items-center justify-center" style={{ height: 'calc(1px * ((8 * 0.258819043636322) + (8 * 0.9659258127212524)))', width: 'calc(1px * ((8 * 0.9659258127212524) + (8 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[345deg]">
          <div className="relative size-[8px]">
            <img alt="" className="block size-full max-w-none" src="http://localhost:3845/assets/a5e891b23d4d7bb85b8d29317867a530e4bd8331.svg" />
          </div>
        </div>
      </div>
      <div className="absolute left-[322px] top-[35px] flex items-center justify-center" style={{ height: 'calc(1px * ((6 * 0.258819043636322) + (6 * 0.9659258127212524)))', width: 'calc(1px * ((6 * 0.9659258127212524) + (6 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[345deg]">
          <div className="relative size-[6px]">
            <img alt="" className="block size-full max-w-none" src="http://localhost:3845/assets/370e5ce21768319797ba27c5063d2e3cd23ad554.svg" />
          </div>
        </div>
      </div>
      <div className="absolute left-[130px] top-[55px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.258819043636322) + (4 * 0.9659258127212524)))', width: 'calc(1px * ((4 * 0.9659258127212524) + (4 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[345deg]">
          <div className="relative size-[4px]">
            <img alt="" className="block size-full max-w-none" src="http://localhost:3845/assets/fa1386b52070087243d0e416a6a1b0b15f30485b.svg" />
          </div>
        </div>
      </div>
      {/* Colored sticks */}
      <div className="absolute left-[225px] top-[125px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.7714588046073914) + (8 * 0.6362792253494263)))', width: 'calc(1px * ((8 * 0.7714588046073914) + (4 * 0.6362792253494263)))' }}>
        <div className="flex-none rotate-[50.485deg]">
          <div className="h-[8px] w-[4px] bg-[#7fd803]" />
        </div>
      </div>
      <div className="absolute left-[79.62px] top-[74.03px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.9659258127212524) + (8 * 0.258819043636322)))', width: 'calc(1px * ((8 * 0.9659258127212524) + (4 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[105deg]">
          <div className="h-[8px] w-[4px] bg-[#ffca09]" />
        </div>
      </div>
      <div className="absolute left-[104px] top-[39px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.2588190734386444) + (8 * 0.9659258127212524)))', width: 'calc(1px * ((8 * 0.2588190734386444) + (4 * 0.9659258127212524)))' }}>
        <div className="flex-none rotate-[165deg]">
          <div className="h-[8px] w-[4px] bg-[#7fd803]" />
        </div>
      </div>
      <div className="absolute left-[310px] top-[112px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.9659258127212524) + (8 * 0.258819043636322)))', width: 'calc(1px * ((8 * 0.9659258127212524) + (4 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[285deg]">
          <div className="h-[8px] w-[4px] bg-[#73b6ff]" />
        </div>
      </div>
      <div className="absolute left-[40px] top-[44px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.8660253882408142) + (10 * 0.4999999701976776)))', width: 'calc(1px * ((10 * 0.8660253882408142) + (4 * 0.4999999701976776)))' }}>
        <div className="flex-none rotate-[300deg]">
          <div className="h-[10px] w-[4px] bg-[#73b6ff]" />
        </div>
      </div>
      <div className="absolute left-[187px] top-[47px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.4999999701976776) + (10 * 0.8660253882408142)))', width: 'calc(1px * ((10 * 0.4999999701976776) + (4 * 0.8660253882408142)))' }}>
        <div className="flex-none rotate-[210deg]">
          <div className="h-[10px] w-[4px] bg-[#ff81d1]" />
        </div>
      </div>
      <div className="absolute left-[55px] top-[121px] flex items-center justify-center" style={{ height: 'calc(1px * ((4 * 0.8660253882408142) + (8 * 0.4999999701976776)))', width: 'calc(1px * ((8 * 0.8660253882408142) + (4 * 0.4999999701976776)))' }}>
        <div className="flex-none rotate-[300deg]">
          <div className="h-[8px] w-[4px] bg-[#ff81d1]" />
        </div>
      </div>
      {/* Small coin - rotated with proper transform wrapper */}
      <div className="absolute left-[209.29px] top-[25px] flex items-center justify-center" style={{ height: 'calc(1px * ((80 * 0.258819043636322) + (80 * 0.9659258127212524)))', width: 'calc(1px * ((80 * 0.9659258127212524) + (80 * 0.258819043636322)))' }}>
        <div className="flex-none rotate-[15deg]">
          <div className="relative size-[80px] overflow-clip">
            <div className="absolute inset-0">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin2} />
            </div>
            <div className="absolute inset-[25.4%_36.25%_24.39%_35.81%]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin2Inner1} />
            </div>
            <div className="absolute inset-[14.57%_12.44%_13.32%_12.41%]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.coin2Inner2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ManageOrdersCard = () => (
  <div className="flex min-h-px min-w-px flex-1 flex-col items-start rounded-tl-[24px] rounded-tr-[24px] rounded-bl-[40px] rounded-br-[40px] bg-[#fafafa]">
    <div className="flex w-full flex-col gap-[16px] items-center p-[32px]">
      <p className="w-full font-['Inter'] text-[20px] font-bold leading-[1.4] text-black">Manage your orders</p>
      <p className="w-full font-['Inter'] text-[16px] font-normal leading-[1.5] text-[#666666]">
        From tutors to therapists, coaches to creators — Timee brings providers together, so clients can find
      </p>
    </div>
    <div className="relative h-[384px] w-full shrink-0 overflow-hidden rounded-[40px] bg-[#e0e6fb]">
      <div className="absolute left-[32px] top-[32px] flex w-[320px] flex-col gap-[16px]">
        {/* English Class Card */}
        <div className="flex w-full flex-col gap-[16px] rounded-[16px] border border-white bg-white px-[16px] pb-[16px] pt-[18px]">
          <p className="w-full font-['Inter'] text-[18px] font-extrabold leading-[1.5] text-black">English Class</p>
          <div className="flex w-full flex-col gap-[12px]">
            <div className="flex w-full gap-[8px] whitespace-pre font-['Inter'] text-[14px] font-medium leading-[1.5] text-nowrap">
              <p className="text-black">Xiao xiao</p>
              <p className="text-center text-[#cccccc]">|</p>
              <p className="text-black"> Mon, Sep 15, 2025</p>
              <p className="text-center text-[#cccccc]">|</p>
              <p className="text-black">08:30</p>
            </div>
            <div className="flex w-full gap-[8px]">
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#eff7ff] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[30.39%_17.89%_23.27%_22.05%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.check} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">Confirmed</p>
              </div>
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#f3f3f3] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[12.5%_8.33%_16.67%_8.33%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.laptop} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-[#666666]">Online</p>
              </div>
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#f3f3f3] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[8.33%_12.5%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.calendar} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-[#666666]">60 min</p>
              </div>
            </div>
          </div>
          <div className="relative h-0 w-full">
            <div className="absolute bottom-[-0.5px] left-0 right-0 top-[-0.5px]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.line} />
            </div>
          </div>
          <div className="flex h-[32px] w-full gap-[12px] items-center justify-end">
            <div className="flex h-[32px] w-[110px] items-center justify-center gap-[8px] rounded-[12px] border border-black bg-black px-[8px] py-[12px]">
              <div className="relative size-[20px] overflow-clip">
                <div className="absolute bottom-[9.38%] left-0 right-0 top-[8.33%]">
                  <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.googleMeet} />
                </div>
              </div>
              <p className="font-['Inter'] text-[14px] font-semibold leading-[1.5] text-white">Join</p>
            </div>
          </div>
        </div>
        {/* Japanese Lessons Card */}
        <div className="flex w-full flex-col gap-[16px] rounded-[16px] border border-white bg-white px-[16px] pb-[16px] pt-[18px]">
          <p className="w-full font-['Inter'] text-[18px] font-extrabold leading-[1.5] text-black">Japanese Lessons</p>
          <div className="flex w-full flex-col gap-[12px]">
            <div className="flex w-full gap-[8px] whitespace-pre font-['Inter'] text-[14px] font-medium leading-[1.5] text-nowrap">
              <p className="text-black">Akira</p>
              <p className="text-center text-[#cccccc]">|</p>
              <p className="text-black"> Wed, Aug 27, 2025</p>
              <p className="text-center text-[#cccccc]">|</p>
              <p className="text-black">19:30</p>
            </div>
            <div className="flex w-full gap-[8px]">
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#eff7ff] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[30.39%_17.89%_23.27%_22.05%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.check} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-black">Confirmed</p>
              </div>
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#f3f3f3] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[8.31%_8.33%_8.33%_8.31%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.homeAlt} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-[#666666]">Offline</p>
              </div>
              <div className="flex items-center gap-[4px] rounded-[8px] bg-[#f3f3f3] px-[6px] py-[4px]">
                <div className="relative size-[20px] overflow-clip">
                  <div className="absolute inset-[8.33%_12.5%]">
                    <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.calendar} />
                  </div>
                </div>
                <p className="text-center font-['Inter'] text-[14px] font-semibold leading-[1.5] text-[#666666]">45 min</p>
              </div>
            </div>
          </div>
          <div className="relative h-0 w-full">
            <div className="absolute bottom-[-0.5px] left-0 right-0 top-[-0.5px]">
              <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.line} />
            </div>
          </div>
          <div className="flex h-[32px] w-full gap-[12px] items-center justify-end">
            <div className="flex h-[32px] w-[110px] items-center justify-center gap-[8px] rounded-[12px] border border-black bg-black px-[8px] py-[12px]">
              <div className="relative size-[20px] overflow-clip">
                <div className="absolute bottom-[9.38%] left-0 right-0 top-[8.33%]">
                  <img alt="" className="block size-full max-w-none" src={ASSETS.andMore.googleMeet} />
                </div>
              </div>
              <p className="font-['Inter'] text-[14px] font-semibold leading-[1.5] text-white">Join</p>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 shadow-[0px_-4px_8px_0px_inset_rgba(0,0,0,0.04)]" />
    </div>
  </div>
);

export default Index;
