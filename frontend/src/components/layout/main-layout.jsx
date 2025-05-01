import Navbar from "./navbar"
import { Toaster } from "@/components/ui/toaster"

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        <div className="px-4 md:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}

export default MainLayout