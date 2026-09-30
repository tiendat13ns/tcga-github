// Pipeline CI cho project tcga — chỉ BUILD + TEST, không deploy.
// Phần deploy đã do GitLab CI (.gitlab-ci.yml) đảm nhiệm, nên Jenkins không đụng tới K8s.
pipeline {
    agent any

    options {
        timestamps()
        // Hỏng quá 20 phút thì tự huỷ, tránh treo máy
        timeout(time: 20, unit: 'MINUTES')
    }

    environment {
        // Tag riêng theo số lần build của Jenkins để không lẫn với image của GitLab CI
        IMG_TAG = "jenkins-${BUILD_NUMBER}"
    }

    stages {
        stage('Build backend') {
            steps {
                // Dùng đúng Dockerfile.prod như GitLab CI, nhưng tag khác
                sh 'docker build -t tcga-backend:${IMG_TAG} -f backend/Dockerfile.prod backend'
            }
        }

        stage('Build frontend') {
            steps {
                // Bước này chạy "npm run build" bên trong (tsc + vite) -> tự kiểm tra TypeScript.
                // Build được nghĩa là frontend không có lỗi biên dịch.
                sh 'docker build -t tcga-frontend:${IMG_TAG} -f frontend/Dockerfile.prod frontend'
            }
        }

        stage('Smoke test backend') {
            steps {
                // Biên dịch toàn bộ file Python để bắt lỗi cú pháp. Không cần .env, không cần DB.
                sh 'docker run --rm tcga-backend:${IMG_TAG} python -m compileall -q app'
            }
        }

        stage('Unit test backend') {
            steps {
                // Test coverage section + schema Requirement, không cần DB/LLM.
                sh 'docker run --rm tcga-backend:${IMG_TAG} python -m unittest test_requirement_coverage test_requirement_schema -v'
            }
        }

        stage('Unit test frontend') {
            steps {
                // Dừng ở stage "build" của Dockerfile.prod (còn node_modules + source) rồi chạy Vitest trong đó.
                sh 'docker build --target build -t tcga-frontend-build:${IMG_TAG} -f frontend/Dockerfile.prod frontend'
                sh 'docker run --rm tcga-frontend-build:${IMG_TAG} npm run test'
            }
        }
    }

    post {
        success {
            echo 'CI OK — cả 2 image build được, backend qua smoke test và unit test 2 phía đều pass.'
        }
        always {
            // Dọn image tạm để không đầy ổ đĩa
            sh 'docker image rm tcga-backend:${IMG_TAG} tcga-frontend:${IMG_TAG} tcga-frontend-build:${IMG_TAG} || true'
        }
    }
}
