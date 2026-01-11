import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Upload, ArrowRight, ArrowLeft, MapPin, User, FileText, Briefcase, Search, Loader2, Check, Gift } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { APP_NAME } from "@/lib/constants";
import { H1, H3 } from "@/design-system";
import { useReferralCode } from "@/hooks/useReferralCode";
import { t, interpolate } from "@/lib/i18n";

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId, refreshProfile } = useAuth();
  const { referralCode, isValid, referrerName, applyReferralCode } = useReferralCode();

  // Get redirect context from URL params
  const returnTo = searchParams.get('returnTo');
  const fromProfile = searchParams.get('fromProfile');
  const serviceId = searchParams.get('serviceId');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: '',
    avatar: '',
    location: '',
    bio: '',
    wantsToProvideService: null as boolean | null
  });

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!userId) {
      toast.error('Please wait for authentication to complete');
      return;
    }

    try {
      setAvatarUploading(true);
      const uploadResult = await ApiClient.uploadFile(file, 'avatar', userId);
      setFormData(prev => ({ ...prev, avatar: uploadResult.url }));
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setIsSubmitting(true);

      // Update user profile with all the collected information
      await ApiClient.updateUserProfile(userId, {
        display_name: formData.display_name,
        avatar: formData.avatar,
        location: formData.location,
        bio: formData.bio,
        is_provider: formData.wantsToProvideService || false
      });

      // Note: Referral code is now automatically applied during authentication
      // No need to manually apply it here

      // Mark onboarding as completed
      await ApiClient.completeOnboarding();

      await refreshProfile();
      toast.success(`Welcome to ${APP_NAME}! Your profile is ready.`);

      // Handle redirect logic based on user's context and preferences
      if (returnTo) {
        // User was trying to access a specific page, redirect them back
        navigate(returnTo);
      } else if (fromProfile && serviceId) {
        // User was trying to book a specific service, redirect to that profile
        const { navigateToUserProfile } = await import('@/lib/username');
        const success = await navigateToUserProfile(fromProfile, (path) => navigate(`${path}?service=${serviceId}`));
        if (!success) {
          navigate('/discover'); // Fallback to discover page
        }
      } else if (fromProfile) {
        // User was viewing someone's profile, redirect back
        const { navigateToUserProfile } = await import('@/lib/username');
        const success = await navigateToUserProfile(fromProfile, navigate);
        if (!success) {
          navigate('/discover'); // Fallback to discover page
        }
      } else if (formData.wantsToProvideService) {
        // User wants to be a host, go to host onboarding flow
        navigate('/host/onboarding');
      } else {
        // User just wants to browse, go to discover page
        navigate('/discover');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromStep = (step: number) => {
    switch (step) {
      case 1: return formData.display_name.trim() !== '';
      case 2: return true; // Avatar and location are optional
      case 3: return true; // Bio is optional
      case 4: return formData.wantsToProvideService !== null;
      default: return false;
    }
  };

  const renderIllustration = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex items-center justify-center h-full">
            <svg viewBox="0 0 300 300" className="w-64 h-64 text-primary">
              <defs>
                <style>
                  {`.illustration { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`}
                </style>
              </defs>
              {/* Person with friendly wave */}
              <circle cx="150" cy="80" r="30" className="illustration" />
              <path d="M150 110 L150 200" className="illustration" />
              <path d="M120 140 L150 130 L170 150" className="illustration" />
              <path d="M130 200 L150 200 L170 200" className="illustration" />
              {/* Waving hand */}
              <circle cx="175" cy="145" r="8" className="illustration" />
              <path d="M183 145 Q190 140 185 135" className="illustration" />
              <path d="M185 140 Q192 135 187 130" className="illustration" />
              <path d="M187 135 Q194 130 189 125" className="illustration" />
              {/* Smile */}
              <path d="M135 75 Q150 90 165 75" className="illustration" />
              <circle cx="142" cy="72" r="2" className="illustration fill-current" />
              <circle cx="158" cy="72" r="2" className="illustration fill-current" />
            </svg>
          </div>
        );

      case 2:
        return (
          <div className="flex items-center justify-center h-full">
            <svg viewBox="0 0 300 300" className="w-64 h-64 text-primary">
              <defs>
                <style>
                  {`.illustration { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`}
                </style>
              </defs>
              {/* Map with pin */}
              <rect x="50" y="80" width="200" height="140" rx="8" className="illustration" />
              <path d="M70 100 Q100 120 130 100 Q160 80 190 100 Q220 120 250 100" className="illustration" />
              <path d="M80 140 Q110 160 140 140 Q170 120 200 140 Q230 160 260 140" className="illustration" />
              <path d="M60 180 Q90 200 120 180 Q150 160 180 180 Q210 200 240 180" className="illustration" />
              {/* Location pin */}
              <path d="M150 60 Q160 50 170 60 Q170 70 160 80 L150 100 L140 80 Q130 70 130 60 Q140 50 150 60 Z" className="illustration" />
              <circle cx="150" cy="65" r="8" className="illustration fill-current" />
            </svg>
          </div>
        );

      case 3:
        return (
          <div className="flex items-center justify-center h-full">
            <svg viewBox="0 0 300 300" className="w-64 h-64 text-primary">
              <defs>
                <style>
                  {`.illustration { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`}
                </style>
              </defs>
              {/* Person with speech bubble */}
              <circle cx="120" cy="80" r="25" className="illustration" />
              <path d="M120 105 L120 180" className="illustration" />
              <path d="M95 130 L120 120 L135 140" className="illustration" />
              <path d="M105 180 L120 180 L135 180" className="illustration" />
              {/* Speech bubble */}
              <ellipse cx="200" cy="100" rx="60" ry="40" className="illustration" />
              <path d="M160 120 L140 140 L150 125" className="illustration" />
              {/* Text lines in bubble */}
              <line x1="170" y1="85" x2="230" y2="85" className="illustration" />
              <line x1="170" y1="95" x2="225" y2="95" className="illustration" />
              <line x1="170" y1="105" x2="220" y2="105" className="illustration" />
              <line x1="170" y1="115" x2="210" y2="115" className="illustration" />
              {/* Smile */}
              <path d="M110 75 Q120 85 130 75" className="illustration" />
              <circle cx="115" cy="72" r="1.5" className="illustration fill-current" />
              <circle cx="125" cy="72" r="1.5" className="illustration fill-current" />
            </svg>
          </div>
        );

      case 4:
        return (
          <div className="flex items-center justify-center h-full">
            <svg viewBox="0 0 300 300" className="w-64 h-64 text-primary">
              <defs>
                <style>
                  {`.illustration { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`}
                </style>
              </defs>
              {/* Person at desk with laptop */}
              <circle cx="150" cy="60" r="20" className="illustration" />
              <path d="M150 80 L150 140" className="illustration" />
              <path d="M130 100 L150 90 L170 105" className="illustration" />
              {/* Desk */}
              <rect x="100" y="140" width="100" height="8" className="illustration" />
              {/* Laptop */}
              <rect x="125" y="125" width="50" height="30" rx="4" className="illustration" />
              <line x1="125" y1="140" x2="175" y2="140" className="illustration" />
              {/* Money/earnings symbols */}
              <circle cx="220" cy="80" r="15" className="illustration" />
              <text x="220" y="85" className="text-xs fill-current text-center" textAnchor="middle">$</text>
              <circle cx="240" cy="110" r="12" className="illustration" />
              <text x="240" y="115" className="text-xs fill-current text-center" textAnchor="middle">$</text>
              <circle cx="210" cy="130" r="10" className="illustration" />
              <text x="210" y="135" className="text-xs fill-current text-center" textAnchor="middle">$</text>
              {/* Smile */}
              <path d="M140 55 Q150 65 160 55" className="illustration" />
              <circle cx="145" cy="52" r="1.5" className="illustration fill-current" />
              <circle cx="155" cy="52" r="1.5" className="illustration fill-current" />
            </svg>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <H1 className="tracking-tight">{t.pages.onboarding.letsGetToKnow}</H1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t.pages.onboarding.nameHelps}
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-base font-medium">Your Name *</Label>
                <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full mt-3">
                  <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666]"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-base font-medium">Profile Photo (Optional)</Label>
                <div className="mt-4 flex flex-col items-start space-y-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={formData.avatar} alt="Profile" />
                    <AvatarFallback className="text-lg">
                      {formData.display_name.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                      disabled={avatarUploading}
                    />
                    <Button 
                      variant="outline" 
                      asChild
                      disabled={avatarUploading}
                      className="h-10"
                    >
                      <label htmlFor="avatar-upload" className="cursor-pointer">
                        {avatarUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {avatarUploading ? 'Uploading...' : 'Upload Photo'}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <H1 className="tracking-tight">{t.pages.onboarding.whereLocated}</H1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t.pages.onboarding.locationHelps}
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="location" className="text-base font-medium">Location (Optional)</Label>
                <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full mt-3">
                  <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                  <Input
                    id="location"
                    placeholder="e.g. San Francisco, CA or London, UK"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666]"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  You can always change this later in your profile settings.
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <H1 className="tracking-tight">{t.pages.onboarding.tellAboutYourself}</H1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t.pages.onboarding.bioHelps}
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="bio" className="text-base font-medium">Bio (Optional)</Label>
                <div className="bg-white box-border content-stretch flex items-start justify-start p-[12px] relative rounded-[8px] shrink-0 w-full mt-3 min-h-[140px]">
                  <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                  <Textarea
                    id="bio"
                    placeholder="e.g. I'm a passionate developer who loves helping others learn new technologies. In my free time, I enjoy hiking and photography."
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    className="basis-0 font-body font-normal grow leading-[1.5] min-h-full min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666] resize-none"
                    maxLength={500}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {formData.bio.length}/500 characters
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <H1 className="tracking-tight">{t.pages.onboarding.readyToBecomeHost}</H1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {interpolate(t.pages.onboarding.earnByOffering, { appName: APP_NAME })}
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div 
                  className={`cursor-pointer transition-all p-6 rounded-lg relative ${
                    formData.wantsToProvideService === true 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'bg-muted/20 hover:bg-muted/50'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, wantsToProvideService: true }))}
                >
                  <div className="flex items-center space-x-4">
                    <Briefcase className="w-8 h-8 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-1 ${
                        formData.wantsToProvideService === true ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                        {t.pages.onboarding.yesBecome}
                      </h3>
                      <p className={formData.wantsToProvideService === true ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                        {t.pages.onboarding.createNookStart}
                      </p>
                    </div>
                    {formData.wantsToProvideService === true && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div 
                  className={`cursor-pointer transition-all p-6 rounded-lg relative ${
                    formData.wantsToProvideService === false 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'bg-muted/20 hover:bg-muted/50'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, wantsToProvideService: false }))}
                >
                  <div className="flex items-center space-x-4">
                    <Search className="w-8 h-8 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-1 ${
                        formData.wantsToProvideService === false ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                        {t.pages.onboarding.notRightNow}
                      </h3>
                      <p className={formData.wantsToProvideService === false ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                        {t.pages.onboarding.justBrowse}
                      </p>
                    </div>
                    {formData.wantsToProvideService === false && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <div className="grid lg:grid-cols-2">
        {/* Left side - Content */}
        <div className="flex flex-col justify-center px-8 py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            {/* Progress indicator */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Welcome to {APP_NAME}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentStep} of {totalSteps}
                </div>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Referral banner if present */}
            {referralCode && isValid && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
                <Gift className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Referral Code Applied!</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {referrerName
                      ? interpolate(t.pages.onboarding.referredBy, { name: referrerName })
                      : t.pages.onboarding.referredByHost}
                  </p>
                </div>
              </div>
            )}

            {/* Step content */}
            <div className="space-y-8">
              {renderStep()}
              
              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 h-11 px-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                
                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceedFromStep(currentStep)}
                    className="flex items-center gap-2 h-11 px-6"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleFinish}
                    disabled={!canProceedFromStep(currentStep) || isSubmitting}
                    className="flex items-center gap-2 h-11 px-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Illustration */}
        <div className="hidden lg:flex bg-muted/20">
          <div className="flex items-center justify-center w-full h-full p-12">
            {renderIllustration()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;