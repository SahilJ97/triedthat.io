import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

const AuthButtons = ({ isMobile = false }) => {  
  const navigate = useNavigate();
  const navigateAndClose = (path) => {
    navigate(path);
  };

  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateAndClose('/login')}
          className="w-full justify-start"
        >
          Log in with LinkedIn
        </Button>
        <Separator />
      </>
    );
  }
  // Desktop: add divider for visual consistency (even if only one button)
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigateAndClose('/login')}
        className="px-3"
      >
        Log in with LinkedIn
      </Button>
    </div>
  );
};

const UserMenu = ({ user, logout, isMobile = false }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const { token } = useAuth();
  const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

  const handleDeleteAccount = async () => {
    setDeleteStatus('pending');
    try {
      const res = await fetch(`${apiUrl}/api/delete-account`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token ? { 'authorization': `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setDeleteStatus('success');
        logout();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteStatus('error');
        alert(data.detail || 'Failed to delete account.');
      }
    } catch (err) {
      setDeleteStatus('error');
      alert('Failed to delete account.');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (isMobile) {
    // Mobile: keep as column, no dividers
    return (
      <div className="flex flex-col space-y-2">
        <Link
          to={`/contribute`}
          className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          Submit
        </Link>
        <Link
          to={`/browse`}
          className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          Browse recent
        </Link>
        <Link
          to={`/my-entries`}
          className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          My entries
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start"
        >
          Logout
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full justify-start text-red-600"
        >
          Delete my data
        </Button>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="bg-white" style={{ backgroundColor: 'white', opacity: 1 }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you would like to delete all your data from triedthat.io? This action is irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteAccount}
                disabled={deleteStatus === 'pending'}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteStatus === 'pending' ? 'Deleting...' : 'Yes'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Desktop: add profile picture dropdown
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center border border-gray-200 cursor-pointer ml-2">
            {user.profile_picture_url ? (
              <img
                src={user.profile_picture_url}
                alt={user.first_name ? `${user.first_name}'s profile` : 'User profile'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-gray-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" fill="#bbb" />
                  <rect x="4" y="16" width="16" height="6" rx="3" fill="#bbb" />
                </svg>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link
              to="/my-entries"
              className="cursor-pointer w-full"
            >
              My entries
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            Logout
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 mt-0"
          >
            Delete my data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white" style={{ backgroundColor: 'white', opacity: 1 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you would like to delete all your data from triedthat.io? This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={deleteStatus === 'pending'}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteStatus === 'pending' ? 'Deleting...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 z-50 w-full border-b bg-white/100 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center">
        <Link to="/" className="mr-6 flex items-center space-x-2 hover:opacity-90 transition-opacity">
          <div className="font-black text-xl tracking-wider flex items-baseline">
            <span className="text-gray-800">triedthat.io</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="flex-1 flex justify-end">
          <nav className="hidden md:flex items-center space-x-0 text-sm font-medium">
            {user ? (
              <>
                <Link
                  to="/contribute"
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-3"
                >
                  Submit
                </Link>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Link
                  to="/browse"
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-3"
                >
                  Browse recent
                </Link>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Link
                  to={`https://github.com/SahilJ97/triedthat.io`}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-3"
                >
                  Source code
                </Link>
                <UserMenu user={user} logout={logout} />
              </>
            ) : (
              <>
                <AuthButtons />
                <Link
                  to={`https://github.com/SahilJ97/triedthat.io`}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-3"
                >
                  Source code
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden flex-1 justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="p-2 mr-8">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-white border-r shadow-lg">
              <div className="flex flex-col space-y-4 mt-4">
                <Link
                  to={`https://github.com/SahilJ97/triedthat.io`}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  Source code
                </Link>
                {user ? (
                  <UserMenu user={user} logout={logout} isMobile={true} />
                ) : (
                  <AuthButtons isMobile={true} />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;