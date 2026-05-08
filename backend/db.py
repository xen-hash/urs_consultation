import pymysql
import pymysql.cursors
from config import DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT


def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        port=DB_PORT,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
    )


def query(sql, args=None, fetchone=False, fetchall=False, commit=False):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args or ())
            if commit:
                conn.commit()
                return cur.lastrowid
            if fetchone:
                return cur.fetchone()
            if fetchall:
                return cur.fetchall()
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()


def execute(sql, args=None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args or ())
            conn.commit()
            return cur.lastrowid
    finally:
        conn.close()