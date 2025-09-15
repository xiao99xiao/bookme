import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiClient } from '@/lib/api-migration'
import { useAuth } from '@/contexts/PrivyAuthContext'
import { CSVLink } from 'react-csv'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Download, DollarSign, TrendingUp, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  created_at: string
  booking_id?: string
  provider?: {
    id: string
    display_name: string
    username?: string
  }
  source_user?: {
    display_name: string
    username?: string
  }
  service?: {
    title: string
    price: number
  }
  booking?: {
    scheduled_at: string
    duration_minutes: number
    location?: string
    is_online: boolean
  }
}

interface IncomeSummary {
  totalIncome: number
  transactionCount: number
  averageTransactionValue: number
  thisMonthIncome: number
}

export default function Income() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<IncomeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (user?.id) {
      loadIncomeData()
    }
  }, [user?.id])

  const loadIncomeData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const [transactionsData, summaryData] = await Promise.all([
        ApiClient.getIncomeTransactions(100, 0),
        ApiClient.getIncomeSummary()
      ])

      const transactions = transactionsData?.transactions || []
      setTransactions(transactions)
      setSummary(summaryData)

      // Prepare CSV data
      const csvFormatted = transactions.map(t => ({
        'Date': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
        'Service': t.service?.title || 'N/A',
        'Customer': t.source_user?.display_name || 'Unknown',
        'Amount': `$${t.amount.toFixed(2)}`,
        'Type': t.type === 'booking_payment' ? 'Booking Payment' : t.type,
        'Description': t.description || '',
        'Location': t.booking?.is_online ? 'Online' : (t.booking?.location || 'N/A')
      }))
      setCsvData(csvFormatted)
    } catch (err: any) {
      console.error('Error loading income data:', err)
      setError(err.message || 'Failed to load income data')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
            <Button onClick={loadIncomeData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const csvHeaders = [
    { label: 'Date', key: 'Date' },
    { label: 'Service', key: 'Service' },
    { label: 'Customer', key: 'Customer' },
    { label: 'Amount', key: 'Amount' },
    { label: 'Type', key: 'Type' },
    { label: 'Description', key: 'Description' },
    { label: 'Location', key: 'Location' }
  ]

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Income</h1>
        <CSVLink
          data={csvData}
          headers={csvHeaders}
          filename={`income-${format(new Date(), 'yyyy-MM-dd')}.csv`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </CSVLink>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.totalIncome?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.transactionCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Transaction</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.averageTransactionValue?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.thisMonthIncome?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Service</th>
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Location</th>
                  <th className="text-right p-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="text-sm">
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(transaction.created_at), 'HH:mm')}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.type === 'inviter_fee'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {transaction.type === 'inviter_fee' ? 'Inviter Fee' : 'Service'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium">
                          {transaction.service?.title || 'N/A'}
                        </div>
                        {transaction.booking && (
                          <div className="text-xs text-gray-500">
                            {transaction.booking.duration_minutes} minutes
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {transaction.source_user?.display_name || 'Unknown'}
                        </div>
                        {transaction.source_user?.username && (
                          <div className="text-xs text-gray-500">
                            @{transaction.source_user.username}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {transaction.booking?.is_online ? (
                            <span className="text-blue-600">Online</span>
                          ) : (
                            <span>{transaction.booking?.location || 'N/A'}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-sm font-semibold text-green-600">
                          +${transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transaction.type === 'inviter_fee' ? 'Referral bonus' : 'Provider earnings'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}