import {
  BookOpen,
  MessageCircle,
  Phone,
  Mail,
  Users,
  Navigation,
  Home,
  Settings,
  HelpCircle,
  Shield,
  Search,
} from "lucide-react";

const helpSections = [
  {
    title: "Getting Started",
    icon: Home,
    items: [
      { title: "Logging In", href: "#logging-in" },
      { title: "Dashboard Overview", href: "#dashboard-overview" },
      { title: "Navigation", href: "#navigation" },
      { title: "Global Search", href: "#global-search" },
    ],
  },
  {
    title: "Resident Features",
    icon: Users,
    items: [
      { title: "My Profile & Settings", href: "#my-profile--settings" },
      { title: "Viewing My Lots", href: "#viewing-my-lots" },
      { title: "Making Payments", href: "#making-payments" },
      { title: "Service Requests", href: "#service-requests" },
      { title: "Amenity Reservations", href: "#amenity-reservations" },
      { title: "Passes & IDs", href: "#passes--ids" },
      { title: "Documents", href: "#documents" },
      { title: "Announcements & Events", href: "#announcements--events" },
      { title: "Community Polls", href: "#community-polls" },
      { title: "Interactive Map", href: "#interactive-map" },
    ],
  },
  {
    title: "Admin Features",
    icon: Settings,
    items: [
      { title: "Admin Dashboard", href: "#admin-dashboard" },
      { title: "Lot Management", href: "#lot-management" },
      { title: "Dues Configuration", href: "#dues-configuration" },
      { title: "Payment Verification", href: "#payment-verification" },
      { title: "Common Areas", href: "#common-areas-management" },
      { title: "Pass Management", href: "#pass-management" },
      { title: "User Management", href: "#user-management" },
      { title: "Sending Notifications", href: "#sending-notifications" },
      { title: "Audit Logs", href: "#audit-logs" },
    ],
  },
  {
    title: "Security & Privacy",
    icon: Shield,
    items: [
      { title: "Rate Limiting", href: "#rate-limiting" },
      { title: "Audit Logging", href: "#audit-logging" },
      { title: "Data Protection", href: "#data-protection" },
    ],
  },
];

const faqItems = [
  {
    category: "Account & Login",
    questions: [
      {
        q: "I forgot my password. What do I do?",
        a: 'Click "Forgot Password" on the login page and follow the instructions to reset it.',
      },
      {
        q: "Can I use my Google account to sign in?",
        a: 'Yes! Click "Sign in with Google" for a secure, password-free login.',
      },
      {
        q: "How do I change my password?",
        a: 'Go to your profile (user menu → top right) and select "Change Password."',
      },
    ],
  },
  {
    category: "Payments",
    questions: [
      {
        q: "What payment methods are accepted?",
        a: "Bank transfer, GCash, Maya, and cash (in-person at the HOA office).",
      },
      {
        q: "How long does payment verification take?",
        a: "Usually 24-48 hours during business days. You'll receive a notification when approved.",
      },
      {
        q: "What if my payment is rejected?",
        a: "You'll receive a notification with the reason. Correct the issue and resubmit.",
      },
    ],
  },
  {
    category: "Service Requests",
    questions: [
      {
        q: "How do I check the status of my request?",
        a: "Go to Service Requests and find your request in the list. Status is shown next to each request.",
      },
      {
        q: "What if my issue is urgent?",
        a: 'Mark the priority as "High" when submitting. For emergencies, contact the HOA office directly by phone.',
      },
    ],
  },
  {
    category: "Reservations",
    questions: [
      {
        q: "How far in advance can I book?",
        a: "Up to 30 days in advance.",
      },
      {
        q: "What if I need to cancel my reservation?",
        a: 'Go to Reservations, find your booking, and click "Cancel." Cancellations must be 24 hours before the booking time.',
      },
    ],
  },
  {
    category: "Security & Privacy",
    questions: [
      {
        q: "Is my personal information secure?",
        a: "Yes. We use JWT authentication, password hashing, role-based access control, and all data is transmitted over HTTPS. Audit logs track all access to sensitive data.",
      },
      {
        q: "Why am I seeing 'Too Many Requests' error?",
        a: "This happens when you exceed the rate limit for API requests (e.g., 30 searches per minute). Wait a minute and try again. This protects against abuse.",
      },
      {
        q: "Can other residents see my information?",
        a: "No. Residents can only view their own lots, payments, and requests. Admins can view all records for management purposes, and all access is logged.",
      },
    ],
  },
];

export function HelpPage() {
  // Detect platform for correct keyboard shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const searchShortcut = isMac ? "⌘K" : "Ctrl+K";

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
            <HelpCircle className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-card-foreground">
              Help & User Guide
            </h1>
            <p className="text-muted-foreground mt-1">
              Everything you need to know about using the Laguna Hills HOA
              Management System
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="sticky top-4 space-y-6">
            {helpSections.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title}>
                  <h3 className="flex items-center gap-2 font-semibold text-card-foreground mb-3">
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </h3>
                  <ul className="space-y-2 ml-6">
                    {section.items.map((item) => (
                      <li key={item.title}>
                        <button
                          onClick={() => scrollToSection(item.href)}
                          className="text-sm text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left"
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Getting Started */}
          <section id="getting-started" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4 flex items-center gap-2">
              <Home className="w-6 h-6" />
              Getting Started
            </h2>

            <div className="space-y-6">
              <div id="logging-in" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Logging In
                </h3>
                <div className="bg-muted/50 dark:bg-muted/10 rounded-lg p-4 border border-border">
                  <ol className="list-decimal list-inside space-y-2 text-card-foreground">
                    <li>Go to the system URL</li>
                    <li>
                      Click <strong>"Login"</strong> in the top right
                    </li>
                    <li>
                      Choose your login method:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-muted-foreground">
                        <li>
                          <strong>Email/Password</strong>: Enter your
                          credentials
                        </li>
                        <li>
                          <strong>Google Account</strong>: Click "Sign in with
                          Google" (recommended)
                        </li>
                      </ul>
                    </li>
                    <li>
                      First-time users will be prompted to complete their
                      profile
                    </li>
                  </ol>
                </div>
              </div>

              <div id="dashboard-overview" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Dashboard Overview
                </h3>
                <p className="text-muted-foreground mb-3">
                  After logging in, you'll see your <strong>Dashboard</strong> -
                  your personalized home base:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      For Residents
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Quick overview of your lots</li>
                      <li>• Payment status</li>
                      <li>• Pending requests</li>
                      <li>• Recent announcements</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      For Admins
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• System-wide statistics</li>
                      <li>• Payment trends</li>
                      <li>• Pending verifications</li>
                      <li>• Action items</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div id="navigation" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Navigation
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">
                      Desktop Navigation
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <strong>Sidebar Menu</strong>: Click items in the left
                        sidebar to access features
                      </li>
                      <li>
                        <strong>Global Search</strong>: Press{" "}
                        <code className="bg-muted px-2 py-1 rounded">
                          {searchShortcut}
                        </code>{" "}
                        to search
                      </li>
                      <li>
                        <strong>Quick Links</strong>: Dashboard cards provide
                        direct access
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">
                      Mobile Navigation
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <strong>Hamburger Menu</strong>: Tap the menu icon (☰)
                        in the top left
                      </li>
                      <li>
                        <strong>Bottom Navigation</strong>: Quick access to
                        Dashboard, Map, and Notifications
                      </li>
                      <li>
                        <strong>Swipe Gestures</strong>: Swipe right to open
                        sidebar
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div id="global-search" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Global Search
                </h3>
                <p className="text-muted-foreground mb-3">
                  The powerful search feature helps you quickly find anything in
                  the system:
                </p>
                <div className="bg-muted/50 dark:bg-muted/10 rounded-lg p-4 border border-border space-y-3">
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">
                      What You Can Search
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        • <strong>Lots</strong> - Search by lot number, block,
                        or owner name
                      </li>
                      <li>
                        • <strong>Users</strong> - Find residents by name,
                        email, or phone
                      </li>
                      <li>
                        • <strong>Households</strong> - Locate households by
                        address or owner
                      </li>
                      <li>
                        • <strong>Service Requests</strong> - Find requests by
                        ID or description
                      </li>
                      <li>
                        • <strong>Payments</strong> - Search payment records and
                        transactions
                      </li>
                      <li>
                        • <strong>Reservations</strong> - Look up bookings by
                        facility or date
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">
                      Search Tips
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        • Results are limited to 10 items per category for
                        faster browsing
                      </li>
                      <li>
                        • Use partial matches - typing "john" finds "Johnson"
                        too
                      </li>
                      <li>
                        • Admin users can search all records; residents see only
                        their own data
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Resident Features */}
          <section id="features-for-residents" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Features for Residents
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeatureCard
                title="My Profile & Settings"
                description="Manage your personal information, change password, and customize preferences"
                icon={Settings}
              />
              <FeatureCard
                title="Viewing My Lots"
                description="See all properties associated with your account, including status and payment info"
                icon={Home}
              />
              <FeatureCard
                title="Making Payments"
                description="Pay HOA dues, vehicle passes, and employee IDs online with multiple payment methods"
                icon={BookOpen}
              />
              <FeatureCard
                title="Service Requests"
                description="Submit maintenance requests and track their status in real-time"
                icon={MessageCircle}
              />
              <FeatureCard
                title="Amenity Reservations"
                description="Book clubhouse, pool, and basketball court for your events"
                icon={Navigation}
              />
              <FeatureCard
                title="Passes & IDs"
                description="Manage vehicle passes and employee IDs for your household"
                icon={BookOpen}
              />
              <FeatureCard
                title="Documents"
                description="Access HOA rules, forms, policies, and meeting minutes"
                icon={BookOpen}
              />
              <FeatureCard
                title="Interactive Map"
                description="View subdivision layout with lot ownership information and boundaries"
                icon={Navigation}
              />
            </div>

            <div className="mt-6 bg-info/10 dark:bg-info/5 rounded-lg p-4 border border-info/20">
              <p className="text-sm text-card-foreground">
                <strong>Tip:</strong> For detailed instructions on each feature,
                see the full{" "}
                <a
                  href="/docs/USER_GUIDE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  User Guide Documentation
                </a>
              </p>
            </div>
          </section>

          {/* Admin Features */}
          <section id="features-for-administrators" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Features for Administrators
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeatureCard
                title="Admin Dashboard"
                description="Overview with system-wide statistics, payment trends, and pending actions"
                icon={Home}
              />
              <FeatureCard
                title="Lot Management"
                description="Manage all properties, ownership assignments, and lot status"
                icon={Settings}
              />
              <FeatureCard
                title="Dues Configuration"
                description="Set payment schedules, amounts, late fees, and discounts"
                icon={BookOpen}
              />
              <FeatureCard
                title="Payment Verification"
                description="Review and approve/reject submitted payments with proof verification"
                icon={BookOpen}
              />
              <FeatureCard
                title="Common Areas"
                description="Manage shared amenities, facilities, and maintenance schedules"
                icon={Navigation}
              />
              <FeatureCard
                title="Pass Management"
                description="Approve vehicle pass and employee ID applications"
                icon={BookOpen}
              />
              <FeatureCard
                title="User Management"
                description="Manage user accounts, roles, and household associations"
                icon={Users}
              />
              <FeatureCard
                title="Audit Logs"
                description="View comprehensive security audit trail of all system activities"
                icon={Shield}
              />
            </div>

            <div id="audit-logs" className="scroll-mt-8 mt-6">
              <h3 className="text-xl font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Audit Logs
              </h3>
              <p className="text-muted-foreground mb-3">
                Admins can view comprehensive audit logs tracking all
                security-relevant events in the system.
              </p>
              <div className="bg-muted/50 dark:bg-muted/10 rounded-lg p-4 border border-border">
                <h4 className="font-medium text-card-foreground mb-2">
                  Tracked Events Include:
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• User login attempts (success and failure)</li>
                  <li>• Data export and search operations</li>
                  <li>• Payment approvals and rejections</li>
                  <li>• User and household modifications</li>
                  <li>• Pass and ID approvals</li>
                  <li>• Configuration changes</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Security & Privacy */}
          <section id="security--privacy" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Security & Privacy
            </h2>

            <div className="space-y-6">
              <div id="rate-limiting" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Rate Limiting
                </h3>
                <p className="text-muted-foreground mb-3">
                  To protect against abuse and ensure fair usage, the system
                  implements rate limiting on all API endpoints:
                </p>
                <div className="bg-muted/50 dark:bg-muted/10 rounded-lg p-4 border border-border">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>
                      <strong>Search:</strong> 30 requests per minute
                    </li>
                    <li>
                      <strong>Admin endpoints:</strong> 100 requests per minute
                    </li>
                    <li>
                      <strong>Authentication:</strong> 10 requests per minute
                    </li>
                    <li>
                      <strong>General:</strong> 200 requests per minute
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Exceeding these limits will return a 429 (Too Many Requests)
                    error. Limits reset automatically after the time window
                    expires.
                  </p>
                </div>
              </div>

              <div id="audit-logging" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Audit Logging
                </h3>
                <p className="text-muted-foreground mb-3">
                  All security-relevant actions are logged for accountability
                  and monitoring:
                </p>
                <div className="bg-muted/50 dark:bg-muted/10 rounded-lg p-4 border border-border space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-card-foreground font-medium">
                      Logged Information:
                    </span>
                    <span className="text-muted-foreground">
                      User ID, timestamp, action type
                    </span>
                    <span className="text-card-foreground font-medium">
                      Resource Tracking:
                    </span>
                    <span className="text-muted-foreground">
                      What data was accessed
                    </span>
                    <span className="text-card-foreground font-medium">
                      Security Events:
                    </span>
                    <span className="text-muted-foreground">
                      Failed logins, unauthorized access
                    </span>
                    <span className="text-card-foreground font-medium">
                      IP Address:
                    </span>
                    <span className="text-muted-foreground">
                      Request origin tracking
                    </span>
                  </div>
                </div>
              </div>

              <div id="data-protection" className="scroll-mt-8">
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Data Protection
                </h3>
                <p className="text-muted-foreground mb-3">
                  The system implements multiple layers of data protection:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      Authentication
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• JWT-based secure sessions</li>
                      <li>• Google OAuth integration</li>
                      <li>• Password hashing</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      Authorization
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Role-based access control</li>
                      <li>• Household ownership verification</li>
                      <li>• Admin-only protected routes</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      Input Sanitization
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• SQL injection prevention</li>
                      <li>• XSS protection</li>
                      <li>• Error message sanitization</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-semibold text-card-foreground mb-2">
                      Privacy Controls
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Residents see only their data</li>
                      <li>• Search result pagination</li>
                      <li>• No sensitive data in logs</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="frequently-asked-questions" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-6 flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              Frequently Asked Questions
            </h2>

            <div className="space-y-6">
              {faqItems.map((category) => (
                <div key={category.category}>
                  <h3 className="text-lg font-semibold text-card-foreground mb-3">
                    {category.category}
                  </h3>
                  <div className="space-y-3">
                    {category.questions.map((item, idx) => (
                      <details
                        key={idx}
                        className="group bg-muted/50 dark:bg-muted/10 rounded-lg border border-border"
                      >
                        <summary className="cursor-pointer p-4 font-medium text-card-foreground hover:bg-muted dark:hover:bg-muted/20 transition-colors flex items-center justify-between">
                          {item.q}
                          <span className="transform group-open:rotate-180 transition-transform">
                            ▼
                          </span>
                        </summary>
                        <div className="px-4 pb-4 text-muted-foreground">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact Support */}
          <section id="getting-help" className="scroll-mt-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4">
              Getting Help
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ContactCard
                title="Messages"
                description="Send messages through the app"
                icon={MessageCircle}
                action="Go to Messages"
                href="/messages"
              />
              <ContactCard
                title="Email Support"
                description="support@lagunahills.com"
                icon={Mail}
                action="Send Email"
                href="mailto:support@lagunahills.com"
              />
              <ContactCard
                title="Call Office"
                description="Mon-Fri, 9AM-5PM"
                icon={Phone}
                action="Contact Us"
                href="tel:+1234567890"
              />
            </div>

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-card-foreground">
                <strong>For Emergencies:</strong> Call the security hotline
                immediately
              </p>
            </div>
          </section>

          {/* Feedback */}
          <section className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-950/20 rounded-lg p-6 border border-primary-200 dark:border-primary-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <MessageCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-card-foreground mb-2">
                  We Want Your Feedback!
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Help us improve the system by sharing your suggestions and
                  reporting issues.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/messages"
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    Send Feedback
                  </a>
                  <a
                    href="/polls"
                    className="inline-flex items-center px-4 py-2 bg-card-foreground text-card-bg rounded-lg hover:bg-card-foreground/90 transition-colors text-sm font-medium"
                  >
                    Take Surveys
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h4 className="font-semibold text-card-foreground mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  title,
  description,
  icon: Icon,
  action,
  href,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-card rounded-lg p-4 border border-border hover:border-primary-300 dark:hover:border-primary-700 transition-colors hover:shadow-md"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h4 className="font-semibold text-card-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
        {action} →
      </span>
    </a>
  );
}
