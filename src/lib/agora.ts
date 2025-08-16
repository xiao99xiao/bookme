import crypto from 'crypto'

// Agora Chat Token Generator
export class AgoraChatToken {
  private static readonly TOKEN_VERSION = '007'
  
  static generateToken(
    appId: string,
    appCertificate: string,
    userId: string,
    expireTime?: number
  ): string {
    if (!appId || !appCertificate || !userId) {
      throw new Error('Missing required parameters for token generation')
    }

    // Set expiration time (default: 24 hours)
    const expire = expireTime || Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    
    // Generate UUID for this token
    const uuid = crypto.randomUUID().replace(/-/g, '')
    
    // Create the message to sign
    const rawData = `${appId}${userId}${uuid}${expire}`
    
    // Sign with HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', appCertificate)
      .update(rawData)
      .digest('hex')
    
    // Encode token components
    const content = Buffer.from(JSON.stringify({
      signature,
      uuid,
      expire
    })).toString('base64')
    
    return `${this.TOKEN_VERSION}${appId}${content}`
  }

  static validateToken(token: string, appId: string): boolean {
    try {
      if (!token.startsWith(this.TOKEN_VERSION + appId)) {
        return false
      }
      
      const content = token.substring((this.TOKEN_VERSION + appId).length)
      const decoded = JSON.parse(Buffer.from(content, 'base64').toString())
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000)
      return decoded.expire > now
    } catch {
      return false
    }
  }
}

// Agora Chat REST API helper
export class AgoraChatAPI {
  private baseUrl: string
  private appKey: string
  private clientId: string
  private clientSecret: string

  constructor(
    orgName: string,
    appName: string,
    clientId: string,
    clientSecret: string
  ) {
    this.baseUrl = `https://a1.easemob.com/${orgName}/${appName}`
    this.appKey = `${orgName}#${appName}`
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  async getAppToken(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get app token: ${response.statusText}`)
      }

      const data = await response.json()
      return data.access_token
    } catch (error) {
      console.error('Error getting Agora app token:', error)
      throw error
    }
  }

  async registerUser(userId: string, password: string): Promise<void> {
    try {
      const appToken = await this.getAppToken()
      
      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appToken}`
        },
        body: JSON.stringify({
          username: userId,
          password: password
        })
      })

      if (!response.ok && response.status !== 400) {
        // 400 might mean user already exists, which is okay
        throw new Error(`Failed to register user: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error registering user:', error)
      throw error
    }
  }

  async createChatRoom(roomName: string, description: string, owner: string): Promise<string> {
    try {
      const appToken = await this.getAppToken()
      
      const response = await fetch(`${this.baseUrl}/chatrooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appToken}`
        },
        body: JSON.stringify({
          name: roomName,
          description: description,
          maxusers: 2, // Private chat between 2 users
          owner: owner,
          members: []
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create chat room: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data.id
    } catch (error) {
      console.error('Error creating chat room:', error)
      throw error
    }
  }
}