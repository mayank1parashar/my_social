from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/', methods=['GET'])
def system_status():
    return jsonify({
        "status": "success",
        "message": "System Online"
    }), 200

if __name__ == '__main__':
    # debug=True automatically reloads the server when you save changes
    app.run(debug=True)