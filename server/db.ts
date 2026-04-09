import mysql from 'mysql2/promise';

const poolConfig: mysql.PoolOptions = {
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Use Unix socket if DB_SOCKET is set (production VPS), else TCP
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '3306');
}

const pool = mysql.createPool(poolConfig);
export default pool;
