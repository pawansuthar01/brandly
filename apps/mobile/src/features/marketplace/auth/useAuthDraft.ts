import { useMobileDispatch, useMobileSelector } from "../../../store/hooks";
import { setSignupContact, setSignupProfile, setSignupRole, setSignupStep, setSignupVerification, type AuthOnboardingStep, type SignupProfileDraft } from "../../../store/store";

export function useAuthDraft() {
  const dispatch = useMobileDispatch();
  const draft = useMobileSelector((state) => state.auth);
  return {
    draft,
    setRole: (role: typeof draft.signupRole) => dispatch(setSignupRole(role)),
    setContact: (contact: { email?: string; phone?: string }) => dispatch(setSignupContact(contact)),
    setVerification: (verification: { emailVerified?: boolean; phoneVerified?: boolean }) => dispatch(setSignupVerification(verification)),
    setStep: (step: AuthOnboardingStep) => dispatch(setSignupStep(step)),
    setProfile: (profile: Partial<SignupProfileDraft>) => dispatch(setSignupProfile(profile)),
  };
}
