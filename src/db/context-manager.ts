import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export class ContextManager {
  private pool: Pool;
  private redis: RedisClientType;
  private currentConversationId: string;

  constructor() {
    // Initialize PostgreSQL
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'mcp_user',
      password: process.env.POSTGRES_PASSWORD || 'mcp_password',
      database: process.env.POSTGRES_DB || 'mcp_multi_ai_pro',
    });

    // Initialize Redis
    this.redis = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Set current conversation ID
    this.currentConversationId = uuidv4();
  }

  async initialize(): Promise<void> {
    // Connect to Redis
    await this.redis.connect();

    // Create tables if they don't exist
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const createConversationsTable = `
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        model VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
    `;

    try {
      await this.pool.query(createConversationsTable);
      await this.pool.query(createMessagesTable);
      await this.pool.query(createIndexes);
      
      // Create a default conversation if none exists
      const result = await this.pool.query('SELECT id FROM conversations ORDER BY created_at DESC LIMIT 1');
      if (result.rows.length > 0) {
        this.currentConversationId = result.rows[0].id;
      } else {
        await this.startNewConversation('Default conversation');
      }
    } catch (error) {
      console.error('Error creating tables:', error);
      // Tables might already exist, continue
    }
  }

  async startNewConversation(title?: string): Promise<string> {
    this.currentConversationId = uuidv4();
    
    const query = `
      INSERT INTO conversations (id, title)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    await this.pool.query(query, [this.currentConversationId, title || 'New Conversation']);
    
    // Clear Redis cache for new conversation
    await this.redis.del(`conversation:${this.currentConversationId}`);
    
    return this.currentConversationId;
  }

  async addMessage(message: Omit<Message, 'id' | 'conversationId' | 'timestamp'>): Promise<Message> {
    // Auto-create conversation if none exists
    if (!this.currentConversationId) {
      await this.startNewConversation('Auto-created conversation');
    }
    
    const id = uuidv4();
    
    const query = `
      INSERT INTO messages (id, conversation_id, role, content, model, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      id,
      this.currentConversationId,
      message.role,
      message.content,
      message.model || null,
      message.metadata || null
    ];
    
    const result = await this.pool.query(query, values);
    const savedMessage = result.rows[0];
    
    // Cache in Redis
    const cacheKey = `conversation:${this.currentConversationId}`;
    await this.redis.rPush(cacheKey, JSON.stringify(savedMessage));
    await this.redis.expire(cacheKey, 3600); // 1 hour cache
    
    // Update conversation timestamp
    await this.pool.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [this.currentConversationId]
    );
    
    return savedMessage;
  }

  async getConversationHistory(conversationId?: string, limit: number = 50): Promise<Message[]> {
    const convId = conversationId || this.currentConversationId;
    const cacheKey = `conversation:${convId}`;
    
    // Try Redis cache first
    const cached = await this.redis.lRange(cacheKey, 0, -1);
    if (cached.length > 0) {
      return cached.map((item: string) => JSON.parse(item));
    }
    
    // Fallback to PostgreSQL
    const query = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY timestamp ASC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [convId, limit]);
    
    // Cache results
    if (result.rows.length > 0) {
      const pipeline = this.redis.multi();
      result.rows.forEach(row => {
        pipeline.rPush(cacheKey, JSON.stringify(row));
      });
      pipeline.expire(cacheKey, 3600);
      await pipeline.exec();
    }
    
    return result.rows;
  }

  async getRecentConversations(limit: number = 10): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations
      ORDER BY updated_at DESC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async searchMessages(searchTerm: string, limit: number = 20): Promise<Message[]> {
    const query = `
      SELECT m.*, c.title as conversation_title
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content ILIKE $1
      ORDER BY m.timestamp DESC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }

  async getSummary(): Promise<any> {
    const conversationCount = await this.pool.query('SELECT COUNT(*) FROM conversations');
    const messageCount = await this.pool.query('SELECT COUNT(*) FROM messages');
    const modelUsage = await this.pool.query(`
      SELECT model, COUNT(*) as count
      FROM messages
      WHERE model IS NOT NULL
      GROUP BY model
      ORDER BY count DESC
    `);
    
    return {
      totalConversations: parseInt(conversationCount.rows[0].count),
      totalMessages: parseInt(messageCount.rows[0].count),
      modelUsage: modelUsage.rows,
      currentConversationId: this.currentConversationId
    };
  }

  async clearAll(): Promise<void> {
    // Clear PostgreSQL
    await this.pool.query('DELETE FROM conversations');
    
    // Clear Redis
    await this.redis.flushDb();
  }

  async close(): Promise<void> {
    await this.pool.end();
    await this.redis.quit();
  }
}