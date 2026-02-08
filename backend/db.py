import pymysql

def get_connection():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="4345f558",
        database="reco",
        cursorclass=pymysql.cursors.DictCursor
    )
