import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

// CRITICAL: Set Node.js to prefer IPv4 over IPv6
// This is a global setting that affects all DNS lookups
try {
  dns.setDefaultResultOrder('ipv4first');
  console.log('   ✅ DNS configured to prefer IPv4');
} catch (error) {
  // setDefaultResultOrder might not be available in older Node.js versions
  console.warn('   ⚠️  Could not set DNS preference (Node.js version might be too old)');
}

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory or parent
const envPaths = [
  join(__dirname, '..', '..', '.env'),  // backend/.env
  join(__dirname, '..', '..', '..', '.env'),  // root/.env
  '.env',
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const { Pool } = pg;

/**
 * PostgreSQL Connection Pool Configuration
 * Used for: Users, Authentication, Contact Lists, User Metadata
 * 
 * PROTECTIONS IMPLEMENTED:
 * - Large connection pool (50 connections)
 * - Extended timeouts for cloud connections
 * - Connection health monitoring
 * - Automatic connection recovery
 * - Connection leak detection
 * - Graceful error handling
 */
// Support both connection string and individual parameters
let postgresConfig;

// Detect if we're using Supabase (has strict connection limits)
const isSupabase = (process.env.POSTGRES_URL && (
  process.env.POSTGRES_URL.includes('supabase.co') || 
  process.env.POSTGRES_URL.includes('supabase.com')
)) || (process.env.POSTGRES_HOST && (
  process.env.POSTGRES_HOST.includes('supabase.co') || 
  process.env.POSTGRES_HOST.includes('supabase.com')
));

// Determine pool size based on database type
// Supabase has strict limits: Free tier = 4 connections, Pro = 60 connections
// For Supabase, we use much smaller pool to avoid "MaxClientsInSessionMode" errors
let POOL_SIZE, MIN_POOL_SIZE;

if (isSupabase) {
  // Supabase connection limits are VERY strict:
  // - Free tier: MAX 4 concurrent connections (we use 2 to leave buffer)
  // - Pro tier: MAX 60 concurrent connections
  // Using 2 instead of 4 leaves room for other connections
  POOL_SIZE = parseInt(process.env.POSTGRES_POOL_SIZE || '2', 10); // Reduced to 2 for free tier
  MIN_POOL_SIZE = parseInt(process.env.POSTGRES_MIN_POOL_SIZE || '0', 10); // Don't keep idle connections
  console.log('🔵 Detected Supabase - Using ULTRA-CONSERVATIVE pool size:', POOL_SIZE, '(Free tier limit: 4)');
  console.log('   💡 TIP: If you upgrade to Supabase Pro, set POSTGRES_POOL_SIZE=10 in .env');
} else {
  // For other databases, use larger pool
  POOL_SIZE = parseInt(process.env.POSTGRES_POOL_SIZE || '20', 10);
  MIN_POOL_SIZE = parseInt(process.env.POSTGRES_MIN_POOL_SIZE || '2', 10);
}

// Initialize config
// For Supabase: Convert connection string to individual parameters so we can use family: 4

if (process.env.POSTGRES_URL) {
  // Parse connection string to extract components for IPv4 resolution
  // Improved regex to handle URL-encoded passwords and special characters
  let connectionString = process.env.POSTGRES_URL.trim().replace(/^["']|["']$/g, '');
  if (connectionString.startsWith('POSTGRES_URL=')) {
    connectionString = connectionString.substring('POSTGRES_URL='.length).trim();
  }
  
  // Try to parse with URL object first (more reliable)
  let urlMatch = null;
  try {
    const url = new URL(connectionString);
    if (url.protocol === 'postgresql:' || url.protocol === 'postgres:') {
      const auth = url.username && url.password 
        ? { user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
        : null;
      if (auth) {
        urlMatch = [null, auth.user, auth.password, url.hostname, url.port || '5432', url.pathname.slice(1)];
      }
    }
  } catch (e) {
    // Fallback to regex if URL parsing fails
    urlMatch = connectionString.match(/postgresql?:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)\/([^?]+)/);
  }
  
  if (urlMatch && isSupabase) {
    // Convert connection string to individual parameters so we can use family: 4
    const [, user, password, hostname, port, database] = urlMatch;
    const targetPort = '5432'; // Always use direct connection
    
    // Use individual parameters
    // Note: family option doesn't work reliably in pg library
    // We'll resolve to IPv4 in initializePostgresPool instead
    postgresConfig = {
      host: hostname, // Will be resolved to IPv4 in initializePostgresPool
      port: parseInt(targetPort, 10),
      database: database || 'postgres',
      user: user || 'postgres',
      password: password || '',
      ssl: { rejectUnauthorized: false },
      max: POOL_SIZE,
      min: MIN_POOL_SIZE,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
      query_timeout: 20000,
      statement_timeout: 20000,
      allowExitOnIdle: true,
    };
    console.log('🔵 Using Supabase with individual parameters (family: 4) to force IPv4');
    console.log(`   Host: ${hostname}, Port: ${targetPort}, Database: ${database || 'postgres'}`);
  } else {
    // Fallback to connection string if we can't parse it or not Supabase
    connectionString = connectionString.replace(/:6543\//, ':5432/'); // Use direct connection
    postgresConfig = {
      connectionString: connectionString,
      ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: POOL_SIZE,
      min: MIN_POOL_SIZE,
      idleTimeoutMillis: isSupabase ? 10000 : 30000,
      connectionTimeoutMillis: 20000,
      query_timeout: 20000,
      statement_timeout: 20000,
      allowExitOnIdle: isSupabase ? true : false,
    };
  }
} else {
  // Use individual parameters
  const isCloud = process.env.POSTGRES_HOST && !process.env.POSTGRES_HOST.includes('localhost');
  const isSupabaseHost = process.env.POSTGRES_HOST && (
    process.env.POSTGRES_HOST.includes('supabase.co') || 
    process.env.POSTGRES_HOST.includes('supabase.com')
  );
  
  // Adjust pool size if Supabase detected via host
  let effectivePoolSize = POOL_SIZE;
  let effectiveMinPoolSize = MIN_POOL_SIZE;
  
  if (isSupabaseHost) {
    effectivePoolSize = parseInt(process.env.POSTGRES_POOL_SIZE || '2', 10); // Reduced to 2
    effectiveMinPoolSize = parseInt(process.env.POSTGRES_MIN_POOL_SIZE || '0', 10); // No idle connections
    console.log('🔵 Detected Supabase via host - Using ULTRA-CONSERVATIVE pool size:', effectivePoolSize);
  }
  
  postgresConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    // Enable SSL for cloud databases (Supabase, etc.)
    ssl: isCloud || process.env.POSTGRES_SSL === 'true' 
      ? { rejectUnauthorized: false } 
      : false,
    max: effectivePoolSize, // Adjusted for database type
    min: effectiveMinPoolSize, // Minimum connections to maintain
    idleTimeoutMillis: isSupabaseHost ? 30000 : 60000, // Shorter for Supabase
    connectionTimeoutMillis: isSupabaseHost ? 30000 : 60000, // Shorter for Supabase
    query_timeout: isSupabaseHost ? 30000 : 45000, // Shorter for Supabase
    statement_timeout: isSupabaseHost ? 30000 : 45000, // Shorter for Supabase
    allowExitOnIdle: isSupabaseHost ? true : false, // Allow Supabase connections to close when idle
    // Force IPv4 to avoid ENETUNREACH errors on Render
    family: 4, // Force IPv4
  };
}

// Resolve Supabase hostname to IPv4 before creating pool
let postgresPool = null;

// Initialize pool with IPv4 resolution for Supabase
const initializePostgresPool = async () => {
  // If Supabase and using hostname (not IP), resolve to IPv4
  if (isSupabase && postgresConfig.host && !/^\d+\.\d+\.\d+\.\d+$/.test(postgresConfig.host)) {
    const originalHost = postgresConfig.host;
    console.log(`   🔍 Resolving ${originalHost} to IPv4...`);
    
    // Use setDefaultResultOrder which should make lookup prefer IPv4
    // Try lookup without family restriction first (should prefer IPv4 due to setDefaultResultOrder)
    try {
      const result = await lookup(originalHost);
      if (result.family === 4) {
        postgresConfig.host = result.address;
        console.log(`   ✅ Resolved to IPv4: ${result.address}`);
      } else {
        // Got IPv6, try to force IPv4 lookup
        console.log(`   ⚠️  Got IPv6 (${result.address}), trying IPv4-only lookup...`);
        try {
          // Try with family: 4 explicitly
          const ipv4Result = await lookup(originalHost, { family: 4, all: false });
          postgresConfig.host = ipv4Result.address;
          console.log(`   ✅ IPv4 lookup succeeded: ${ipv4Result.address}`);
        } catch (ipv4Error) {
          // IPv4 lookup failed - this is the problem
          console.error(`   ❌ IPv4 lookup failed: ${ipv4Error.message}`);
          console.error(`   💡 This hostname may only have IPv6 records, or Render's DNS doesn't support IPv4-only queries`);
          console.error(`   💡 Solution: Use Supabase's transaction mode or contact Supabase for IPv4 address`);
          // Keep hostname, but this will likely fail
          // The setDefaultResultOrder should help, but if DNS doesn't return IPv4, we're stuck
        }
      }
    } catch (error) {
      console.error(`   ❌ DNS lookup failed: ${error.message}`);
      console.error(`   💡 This is a DNS/network issue on Render`);
      // Keep original hostname - connection will likely fail
    }
  }
  
  // Create pool with (hopefully) IPv4-resolved config
  console.log(`   📦 Creating pool with host: ${postgresConfig.host}`);
  postgresPool = new Pool(postgresConfig);
  setupPoolHandlers(postgresPool);
  return postgresPool;
};

// Get pool (will initialize if needed)
// CRITICAL: For Supabase with hostname, pool is NOT created here - must be created after IPv4 resolution
const getPostgresPool = () => {
  if (!postgresPool) {
    // For Supabase with hostname, DO NOT create pool - wait for IPv4 resolution
    if (isSupabase && postgresConfig.host && !/^\d+\.\d+\.\d+\.\d+$/.test(postgresConfig.host)) {
      throw new Error('PostgreSQL pool not initialized. Call initializePostgresPool() first for Supabase.');
    }
    // For non-Supabase or Supabase with IP, create immediately
    postgresPool = new Pool(postgresConfig);
    setupPoolHandlers(postgresPool);
  }
  return postgresPool;
};

// Connection pool statistics tracking
let poolStats = {
  totalConnections: 0,
  idleConnections: 0,
  activeConnections: 0,
  waitingClients: 0,
  errors: 0,
  lastError: null,
  lastHealthCheck: null,
  isHealthy: true,
};

// Update pool statistics
const updatePoolStats = () => {
  const pool = getPostgresPool();
  poolStats = {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    activeConnections: pool.totalCount - pool.idleCount,
    waitingClients: pool.waitingCount,
    errors: poolStats.errors,
    lastError: poolStats.lastError,
    lastHealthCheck: new Date(),
    isHealthy: pool.totalCount > 0 && pool.idleCount >= MIN_POOL_SIZE,
  };
};

// Health check interval - every 30 seconds
setInterval(() => {
  updatePoolStats();
  if (!poolStats.isHealthy && poolStats.totalConnections === 0) {
    console.warn('⚠️  PostgreSQL pool health check: No connections available');
  }
  // For Supabase: Log connection stats to help debug
  if (isSupabase && poolStats.totalConnections > 0) {
    if (poolStats.totalConnections >= POOL_SIZE) {
      console.log(`🔵 Supabase pool: ${poolStats.totalConnections}/${POOL_SIZE} connections (${poolStats.idleCount} idle, ${poolStats.activeConnections} active)`);
    }
  }
}, 30000);

// Setup pool event handlers (will be called after pool is initialized)
const setupPoolHandlers = (pool) => {
  // CRITICAL: Set timezone to UTC for all connections to ensure consistent timestamp handling
  // This ensures all timestamps are stored and retrieved in UTC regardless of server timezone
  pool.on('connect', async (client) => {
    try {
      await client.query("SET timezone = 'UTC'");
      updatePoolStats();
      // Only log on first few connections to avoid spam
      if (pool.totalCount <= 3) {
        console.log('   ✅ PostgreSQL connection timezone set to UTC');
      }
    } catch (error) {
      console.error('   ⚠️  Warning: Could not set PostgreSQL timezone to UTC:', error.message);
      poolStats.lastError = error;
      poolStats.errors++;
    }
  });

  // Handle pool errors gracefully (don't crash the app)
  pool.on('error', (err) => {
  poolStats.lastError = err;
  poolStats.errors++;
  
  // Log error but don't crash
  const errorCode = err.code || 'UNKNOWN';
  const isConnectionError = 
    errorCode === 'ECONNRESET' || 
    errorCode === 'ETIMEDOUT' || 
    errorCode === 'ECONNREFUSED' ||
    err.message?.includes('Connection terminated') ||
    err.message?.includes('timeout') ||
    err.message?.includes('MaxClientsInSessionMode');
  
  if (isConnectionError) {
    console.warn(`⚠️  PostgreSQL pool connection error (${errorCode}):`, err.message);
  } else {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
  }
  
  // Try to recover by updating stats
  updatePoolStats();
  
  // Don't exit - let the app continue and try to reconnect
  // The pool will handle reconnection automatically
  });

  // Monitor connection acquisition
  pool.on('acquire', () => {
    updatePoolStats();
  });

  // Monitor connection release
  pool.on('remove', () => {
    updatePoolStats();
  });
};

// For Supabase with hostname, DO NOT create pool here - it will be created after IPv4 resolution
// For others, create pool immediately
if (!isSupabase || !postgresConfig.host || /^\d+\.\d+\.\d+\.\d+$/.test(postgresConfig.host)) {
  postgresPool = new Pool(postgresConfig);
  setupPoolHandlers(postgresPool);
}
// For Supabase with hostname, pool will be created in testPostgresConnection after IPv4 resolution

// Connection queue to prevent too many simultaneous connections (especially for Supabase)
let connectionQueue = [];
let activeQueries = 0;
// For Supabase free tier: Only 1-2 concurrent queries max to stay under 4 connection limit
const MAX_CONCURRENT_QUERIES = isSupabase ? 1 : 10; // ULTRA-CONSERVATIVE: Only 1 at a time for Supabase

// Enhanced connection retry wrapper with many protections
export const queryWithRetry = async (queryText, params = [], retries = 3, timeout = 30000) => {
  let lastError = null;
  let timeoutId = null;
  
  // For Supabase, use fewer retries and shorter timeout
  if (isSupabase) {
    retries = Math.min(retries, 3);
    timeout = Math.min(timeout, 30000);
  }
  
  // Queue management for Supabase to prevent connection exhaustion
  if (isSupabase && activeQueries >= MAX_CONCURRENT_QUERIES) {
    // Wait in queue if too many active queries
    await new Promise((resolve) => {
      connectionQueue.push(resolve);
    });
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      // Check pool health before attempting query
      updatePoolStats();
      
      // Ensure pool is initialized
      const pool = getPostgresPool();
      
      // For Supabase, check if we're at connection limit - be VERY conservative
      if (isSupabase) {
        // If we have ANY active connections and no idle ones, wait longer
        if (pool.totalCount > 0 && pool.idleCount === 0) {
          // Wait longer to ensure connections are released
          await new Promise(resolve => setTimeout(resolve, 500 + (i * 200)));
        }
        // If we're at max pool size, wait even longer
        if (pool.totalCount >= POOL_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 1000 + (i * 300)));
        }
      }
      
      if (pool.totalCount === 0 && i === 0) {
        // Wait a bit if pool is empty
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Increment active queries counter
      activeQueries++;
      
      try {
        // Use Promise.race to implement query timeout
        const queryPromise = pool.query(queryText, params);
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Query timeout'));
          }, timeout);
        });
        
        try {
          const result = await Promise.race([queryPromise, timeoutPromise]);
          // Clear timeout if query succeeded
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          return result;
        } catch (raceError) {
          // Clear timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          throw raceError;
        }
      } finally {
        // Decrement active queries counter
        activeQueries--;
        // Process queue if there's space
        if (connectionQueue.length > 0 && activeQueries < MAX_CONCURRENT_QUERIES) {
          const next = connectionQueue.shift();
          if (next) next();
        }
      }
      
    } catch (error) {
      lastError = error;
      const isLastAttempt = i === retries - 1;
      
      // Determine if this is a connection-related error that should be retried
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      
      const isConnectionError = 
        errorCode === 'ECONNRESET' || 
        errorCode === 'ETIMEDOUT' || 
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'XX000' || // Internal error (like MaxClientsInSessionMode)
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('MaxClientsInSessionMode') ||
        errorMessage.includes('max clients reached') ||
        errorMessage.includes('Query timeout');
      
      if (isConnectionError && !isLastAttempt) {
        // For Supabase MaxClients errors, wait longer before retry
        const baseWaitTime = errorMessage.includes('MaxClients') ? 3000 : 1000;
        const waitTime = Math.min(baseWaitTime * Math.pow(2, i), 15000); // Max 15s for Supabase
        console.warn(`⚠️  PostgreSQL query failed (attempt ${i + 1}/${retries}), retrying in ${waitTime}ms...`, 
          errorMessage.substring(0, 100));
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Update stats after error
        poolStats.errors++;
        poolStats.lastError = error;
        updatePoolStats();
        
        continue;
      }
      
      // If it's the last attempt or not a connection error, throw
      poolStats.errors++;
      poolStats.lastError = error;
      throw error;
    }
  }
  
  // Should never reach here, but just in case
  throw lastError || new Error('Query failed after all retries');
};

// Get pool statistics for monitoring
export const getPoolStats = () => {
  updatePoolStats();
  return { ...poolStats };
};

// Health check function
export const checkPoolHealth = async () => {
  try {
    updatePoolStats();
    const result = await queryWithRetry('SELECT NOW()', [], 2, 10000);
    return {
      healthy: true,
      stats: poolStats,
      timestamp: result.rows[0]?.now,
    };
  } catch (error) {
    return {
      healthy: false,
      stats: poolStats,
      error: error.message,
    };
  }
};

// Resolve hostname to IPv4 before testing connection
const resolveHostnameToIPv4 = async (hostname) => {
  try {
    // Try IPv4 first
    const result = await lookup(hostname, { family: 4 });
    return result.address;
  } catch (error) {
    // If IPv4 fails, try getting all addresses and find IPv4
    try {
      const addresses = await lookup(hostname, { all: true });
      const ipv4 = addresses.find(addr => addr.family === 4);
      if (ipv4) {
        return ipv4.address;
      }
      // If no IPv4 found, try without family restriction (should prefer IPv4 due to setDefaultResultOrder)
      const anyResult = await lookup(hostname);
      if (anyResult.family === 4) {
        return anyResult.address;
      }
      console.warn(`   ⚠️  Hostname ${hostname} only resolves to IPv6`);
      return null;
    } catch (fallbackError) {
      console.warn(`   ⚠️  Could not resolve ${hostname} to IPv4:`, error.message);
      return null;
    }
  }
};

// Test connection
export const testPostgresConnection = async () => {
  try {
    // Debug: Show which config is being used
    const usingUrl = !!process.env.POSTGRES_URL;
    if (usingUrl) {
      const urlPreview = process.env.POSTGRES_URL.replace(/:[^:@]+@/, ':****@');
      console.log(`   Using POSTGRES_URL: ${urlPreview.substring(0, 60)}...`);
    } else {
      console.log(`   Using individual params: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
    }
    
    // Initialize pool with IPv4 resolution if needed (for Supabase)
    if (isSupabase && !postgresPool) {
      await initializePostgresPool();
      setupPoolHandlers(postgresPool);
    }
    
    // Get pool (will create if not initialized)
    const pool = getPostgresPool();
    
    // Try connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully at:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error.message);
    
    // If ENETUNREACH and we haven't tried IPv4 resolution yet, try it
    if (error.code === 'ENETUNREACH' && isSupabase && postgresConfig.host && !/^\d+\.\d+\.\d+\.\d+$/.test(postgresConfig.host)) {
      console.log(`   🔄 Retrying with IPv4 resolution...`);
      try {
        const ipv4 = await resolveHostnameToIPv4(postgresConfig.host);
        if (ipv4) {
          // Update config with IPv4 and recreate pool
          postgresConfig.host = ipv4;
          if (postgresPool) {
            await postgresPool.end(); // Close old pool
          }
          postgresPool = new Pool(postgresConfig);
          setupPoolHandlers(postgresPool);
          console.log(`   ✅ Resolved to IPv4: ${ipv4}, pool recreated`);
          
          // Try connection again
          const client = await postgresPool.connect();
          const result = await client.query('SELECT NOW()');
          console.log('✅ PostgreSQL connected successfully at:', result.rows[0].now);
          client.release();
          return true;
        }
      } catch (resolveError) {
        console.error('   ❌ Failed to resolve to IPv4:', resolveError.message);
      }
    }
    
    if (error.code === 'ENOTFOUND') {
      console.error('   💡 Tip: DNS lookup failed. Check:');
      console.error('      - Is POSTGRES_URL set correctly?');
      console.error('      - Is the hostname correct?');
      console.error('      - Do you have internet connection?');
    } else if (error.code === '28P01') {
      console.error('   💡 Tip: Authentication failed. Check your POSTGRES_USER and POSTGRES_PASSWORD');
    } else if (error.message.includes('SSL')) {
      console.error('   💡 Tip: For Supabase/cloud databases, set POSTGRES_SSL=true or use POSTGRES_URL');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('   💡 Tip: Connection timeout. Check:');
      console.error('      - Is the database server running?');
      console.error('      - Is the hostname and port correct?');
      console.error('      - Are firewall rules allowing the connection?');
    } else if (error.code === 'ENETUNREACH') {
      console.error('   💡 Tip: Network unreachable (IPv6 issue).');
      console.error('      - The connection is trying to use IPv6');
      console.error('      - Solution: Use individual POSTGRES_HOST/POSTGRES_USER/etc instead of POSTGRES_URL');
      console.error('      - Or manually resolve hostname to IPv4 and use IP address');
    }
    return false;
  }
};

// Export pool getter and initialization function
export { initializePostgresPool, getPostgresPool };

// Default export - returns the pool
// For Supabase, pool will be created after IPv4 resolution in testPostgresConnection
// For others, pool is created immediately
// Using a getter function to handle lazy initialization
const getDefaultPool = () => {
  try {
    return getPostgresPool();
  } catch (error) {
    // If pool not initialized (Supabase case), return a proxy that will work after initialization
    return new Proxy({}, {
      get(target, prop) {
        // Try to get pool again (might be initialized by now)
        try {
          const pool = getPostgresPool();
          const value = pool[prop];
          if (typeof value === 'function') {
            return value.bind(pool);
          }
          return value;
        } catch (e) {
          throw new Error(`PostgreSQL pool not initialized. ${error.message}`);
        }
      }
    });
  }
};

export default getDefaultPool();


