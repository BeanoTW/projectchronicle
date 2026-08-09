// Single mount point for the app's bottom navigation. The rendered screen owns
// which system appears — never CSS or z-index.
import BottomNav from './BottomNav';
import V2BottomNav from './V2BottomNav';
import { useNavigationOwner } from './NavigationOwnership';

const AppNavigation = () => {
  const owner = useNavigationOwner();
  return owner === 'v2' ? <V2BottomNav /> : <BottomNav />;
};

export default AppNavigation;
