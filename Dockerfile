FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make sure directories exist
RUN mkdir -p templates static

CMD ["python", "main.py"] 