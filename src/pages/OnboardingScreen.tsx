// Onboarding has been replaced by WelcomeScreen.
// This file is kept as a redirect fallback.
import { Navigate } from 'react-router-dom';

const OnboardingScreen = () => <Navigate to="/" replace />;

export default OnboardingScreen;
