import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Upload, ArrowRight, ArrowLeft, MapPin, User, FileText, Briefcase, Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId, refreshProfile } = useAuth();
  
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

      await refreshProfile();
      toast.success('Welcome to BookMe! Your profile is ready.');

      // Handle redirect logic based on user's context and preferences
      if (returnTo) {
        // User was trying to access a specific page, redirect them back
        navigate(returnTo);
      } else if (fromProfile && serviceId) {
        // User was trying to book a specific service, redirect to that profile
        navigate(`/profile/${fromProfile}?service=${serviceId}`);
      } else if (fromProfile) {
        // User was viewing someone's profile, redirect back
        navigate(`/profile/${fromProfile}`);
      } else if (formData.wantsToProvideService) {
        // User wants to provide services, go to edit profile to create services
        navigate('/provider/services');
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
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Let's get to know you!</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Your name helps others identify you when booking services or viewing your profile.
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-base font-medium">Your Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.display_name}
                  onChange={(e) => handleInputChange('display_name', e.target.value)}
                  className="mt-3 h-12 text-base"
                />
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
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Where are you located?</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                This helps match you with nearby services and lets others know your general area when you offer services.
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="location" className="text-base font-medium">Location (Optional)</Label>
                <Input
                  id="location"
                  placeholder="e.g. San Francisco, CA or London, UK"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="mt-3 h-12 text-base"
                />
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
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Tell us about yourself</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A brief bio helps others understand who you are and what you're passionate about. This appears on your profile.
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="bio" className="text-base font-medium">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="e.g. I'm a passionate developer who loves helping others learn new technologies. In my free time, I enjoy hiking and photography."
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="mt-3 min-h-[140px] text-base leading-relaxed"
                  maxLength={500}
                />
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
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Ready to share your expertise?</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                BookMe lets you earn by offering your skills and knowledge to others. You can always change this later.
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
                        Yes, I want to offer services
                      </h3>
                      <p className={formData.wantsToProvideService === true ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                        Start earning by sharing your skills and expertise with others
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
                        Not right now
                      </h3>
                      <p className={formData.wantsToProvideService === false ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                        I just want to browse and book services from others
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
    <div className="min-h-screen bg-background">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left side - Content */}
        <div className="flex flex-col justify-center px-8 py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            {/* Progress indicator */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Welcome to BookMe
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentStep} of {totalSteps}
                </div>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

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