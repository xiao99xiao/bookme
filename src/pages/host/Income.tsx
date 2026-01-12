import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiClient } from '@/lib/api-migration'
import { useAuth } from '@/contexts/PrivyAuthContext'
import { CSVLink } from 'react-csv'
import { Download, DollarSign, TrendingUp, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { t } from '@/lib/i18n'
import { useSetPageTitle } from '@/contexts/PageTitleContext'
import { Button } from '@/design-system'
import './styles/host-dashboard.css'

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
  // Set page title for AppHeader
  useSetPageTitle(t.pages.earnings.title, 'Track your earnings and transactions')

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
        'Talk': t.service?.title || 'N/A',
        'Visitor': t.source_user?.display_name || 'Unknown',
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
      <div className="income-loading">
        <div className="income-loading__header" />
        <div className="income-loading__cards">
          <div className="income-loading__card" />
          <div className="income-loading__card" />
          <div className="income-loading__card" />
          <div className="income-loading__card" />
        </div>
        <div className="income-loading__table" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="income-container">
        <div className="income-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>
          <Button onClick={loadIncomeData} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const csvHeaders = [
    { label: 'Date', key: 'Date' },
    { label: 'Talk', key: 'Talk' },
    { label: 'Visitor', key: 'Visitor' },
    { label: 'Amount', key: 'Amount' },
    { label: 'Type', key: 'Type' },
    { label: 'Description', key: 'Description' },
    { label: 'Location', key: 'Location' }
  ]

  return (
    <div className="income-container">
      {/* Header */}
      <div className="income-header">
        <h1 className="income-header__title">{t.pages.earnings.title}</h1>
        <CSVLink
          data={csvData}
          headers={csvHeaders}
          filename={`income-${format(new Date(), 'yyyy-MM-dd')}.csv`}
          className="income-header__export"
        >
          <Download />
          Export CSV
        </CSVLink>
      </div>

      {/* Summary Cards */}
      <div className="income-summary">
        <div className="income-card">
          <div className="income-card__header">
            <p className="income-card__label">Total Earnings</p>
            <DollarSign className="income-card__icon" />
          </div>
          <p className="income-card__value income-card__value--highlight">
            ${summary?.totalIncome?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="income-card">
          <div className="income-card__header">
            <p className="income-card__label">Total Transactions</p>
            <TrendingUp className="income-card__icon" />
          </div>
          <p className="income-card__value">
            {summary?.transactionCount || 0}
          </p>
        </div>

        <div className="income-card">
          <div className="income-card__header">
            <p className="income-card__label">Average Transaction</p>
            <Calendar className="income-card__icon" />
          </div>
          <p className="income-card__value">
            ${summary?.averageTransactionValue?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="income-card">
          <div className="income-card__header">
            <p className="income-card__label">This Month</p>
            <User className="income-card__icon" />
          </div>
          <p className="income-card__value income-card__value--highlight">
            ${summary?.thisMonthIncome?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="income-table-container">
        <div className="income-table-header">
          <h2 className="income-table-title">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="income-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Talk</th>
                <th>Visitor</th>
                <th>Location</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="income-table__empty">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="income-table__date">
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                      </div>
                      <div className="income-table__time">
                        {format(new Date(transaction.created_at), 'HH:mm')}
                      </div>
                    </td>
                    <td>
                      <span className={`income-table__type-badge ${
                        transaction.type === 'inviter_fee'
                          ? 'income-table__type-badge--referral'
                          : 'income-table__type-badge--talk'
                      }`}>
                        {transaction.type === 'inviter_fee' ? t.pages.earnings.referralFee : t.talk.singular}
                      </span>
                    </td>
                    <td>
                      <div className="income-table__talk-name">
                        {transaction.service?.title || 'N/A'}
                      </div>
                      {transaction.booking && (
                        <div className="income-table__talk-duration">
                          {transaction.booking.duration_minutes} minutes
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="income-table__visitor">
                        {transaction.source_user?.display_name || 'Unknown'}
                      </div>
                      {transaction.source_user?.username && (
                        <div className="income-table__visitor-username">
                          @{transaction.source_user.username}
                        </div>
                      )}
                    </td>
                    <td>
                      {transaction.booking?.is_online ? (
                        <span className="income-table__location--online">Online</span>
                      ) : (
                        <span>{transaction.booking?.location || 'N/A'}</span>
                      )}
                    </td>
                    <td>
                      <div className="income-table__amount">
                        +${transaction.amount.toFixed(2)}
                      </div>
                      <div className="income-table__amount-label">
                        {transaction.type === 'inviter_fee' ? t.pages.earnings.referralBonus : t.pages.earnings.hostEarnings}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}