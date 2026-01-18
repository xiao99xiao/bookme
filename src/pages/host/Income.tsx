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
import '@/styles/design-system-2025.css'

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
      <div className="ds-page">
        <div className="ds-loading">
          <div className="ds-loading__header" />
          <div className="ds-loading__grid-4">
            <div className="ds-loading__card" />
            <div className="ds-loading__card" />
            <div className="ds-loading__card" />
            <div className="ds-loading__card" />
          </div>
          <div className="ds-loading__table" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ds-page">
        <div className="ds-error">
          <p className="ds-error__message">Error: {error}</p>
          <button className="ds-error__btn" onClick={loadIncomeData}>
            Retry
          </button>
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
    <div className="ds-page">
      {/* Header */}
      <div className="ds-header ds-header--with-actions">
        <h1 className="ds-header__title">{t.pages.earnings.title}</h1>
        <CSVLink
          data={csvData}
          headers={csvHeaders}
          filename={`income-${format(new Date(), 'yyyy-MM-dd')}.csv`}
          className="ds-btn ds-btn--outline"
        >
          <Download />
          Export CSV
        </CSVLink>
      </div>

      {/* Summary Cards */}
      <div className="ds-summary-grid">
        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Total Earnings</p>
            <DollarSign className="ds-card__icon" />
          </div>
          <p className="ds-card__value ds-card__value--success">
            ${summary?.totalIncome?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Total Transactions</p>
            <TrendingUp className="ds-card__icon" />
          </div>
          <p className="ds-card__value">
            {summary?.transactionCount || 0}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Average Transaction</p>
            <Calendar className="ds-card__icon" />
          </div>
          <p className="ds-card__value">
            ${summary?.averageTransactionValue?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">This Month</p>
            <User className="ds-card__icon" />
          </div>
          <p className="ds-card__value ds-card__value--success">
            ${summary?.thisMonthIncome?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ds-section">
        <div className="ds-section__header">
          <h2 className="ds-section__title">Transaction History</h2>
        </div>
        <div className="ds-section__content ds-section__content--no-padding" style={{ overflowX: 'auto' }}>
          <table className="ds-table">
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
                  <td colSpan={6}>
                    <div className="ds-empty">
                      <p className="ds-empty__title">No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction, index) => (
                  <tr key={transaction.id} className="ds-animate-row" style={{ animationDelay: `${200 + index * 30}ms` }}>
                    <td>
                      <div className="ds-table__date">
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                      </div>
                      <div className="ds-table__time">
                        {format(new Date(transaction.created_at), 'HH:mm')}
                      </div>
                    </td>
                    <td>
                      <span className={`ds-badge ${
                        transaction.type === 'inviter_fee'
                          ? 'ds-badge--purple'
                          : 'ds-badge--blue'
                      }`}>
                        {transaction.type === 'inviter_fee' ? t.pages.earnings.referralFee : t.talk.singular}
                      </span>
                    </td>
                    <td>
                      <div className="ds-table__primary">
                        {transaction.service?.title || 'N/A'}
                      </div>
                      {transaction.booking && (
                        <div className="ds-table__secondary">
                          {transaction.booking.duration_minutes} minutes
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="ds-table__primary">
                        {transaction.source_user?.display_name || 'Unknown'}
                      </div>
                      {transaction.source_user?.username && (
                        <div className="ds-table__secondary">
                          @{transaction.source_user.username}
                        </div>
                      )}
                    </td>
                    <td>
                      {transaction.booking?.is_online ? (
                        <span className="ds-badge ds-badge--green">Online</span>
                      ) : (
                        <span>{transaction.booking?.location || 'N/A'}</span>
                      )}
                    </td>
                    <td>
                      <div className="ds-table__amount">
                        +${transaction.amount.toFixed(2)}
                      </div>
                      <div className="ds-table__secondary">
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