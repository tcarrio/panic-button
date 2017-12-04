import * as io from 'socket.io-client';
import { Component, OnInit, HostBinding } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf } from '@angular/common';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { Observable } from 'rxjs/Observable';


@Component({
  selector: 'class-hub',
  templateUrl: './class-hub.html',
  styleUrls: ['./class-hub.css']
})
export class ClassHubComponent {
  socket: any;
  private HTTP: HttpClient;
  numberPanic: number;
  token: any;
  currentClassroomId: string;
  classroom: Classroom;
  panicStates: {[classroom: string]: boolean};
  panicNumbers: {[classroomId: string]: number};
  isPanic: boolean;
  studentCount: number;
  percentPanicked: number;
  newQuestion: string;
  isQuestionAsked: boolean;
  replyMode: boolean;
  replyQuestionId: string;
  replyQuestion: string;
  questionAnswers: QuestionAnswers = {};
  questionAnswer: string;
  courseInfo: string;
  currentTopic: string;
  firstTopic: boolean;
  lastTopic: boolean;
  myUserId: string;
  showAnswers: ShowAnswerMap;
  showChart: boolean;
  testData: [number];
  chartData: [ChartData];
  chartLabels: string[];
  chartOptions: LineChartOptions;
  showPanicChart: boolean;
  testPanicData: [number];
  panicChartData: [ChartData];
  panicChartLabels: string[];
  panicChartOptions: DonutChartOptions;


  constructor(private http: HttpClient, private router: Router,  private route: ActivatedRoute) {
    this.HTTP = http;
    this.panicStates = {};
    this.panicNumbers = {};
    this.currentClassroomId = '';
    const url = '/api/v1/authenticate';
    this.isPanic = false;
    this.numberPanic = 0;
    this.percentPanicked = 0;
    this.isQuestionAsked = false;
    this.newQuestion = '';
    this.replyMode = false;
    this.testData = [this.percentPanicked];
    this.classroom = {
      _id: '',
      courseNumber: '',
      courseTitle: '',
      role: '',
      courseType: '',
      sectionNumber: '',
      studentCount: -1,
      studentCode: '',
      teacherCode: '',
      questions: [] as [Question],
      students: [] as [string],
      teachers: [] as [string],
      teacherAssistants: [] as [string],
      topics: [] as [string],
      currentTopic: 0,
      schoolId: '',
      schoolName: ''
    };
    this.chartData = [
      { data: this.testData, label: 'Panics' }
    ];
    this.chartOptions = {
      responsive: true
    };
    this.showChart = false;
    this.showPanicChart = false;
    this.testPanicData = {
      datasets: [{
        data: [0, 100]
      }]
    };
    this.panicChartData
    this.panicChartLabels
    this.panicChartOptions = {
      cutoutPercentage: 80
    };

    this.setTopicInfo('General', true, true);
    this.setClassInfo();
    this.addNewQuestionsToViewLogic();

    this.route.queryParams.subscribe(params => {
      this.currentClassroomId = params['id'];
    });

    this.GetClassroomObject();

    http.post(url, {})
      .subscribe((data) => {
        this.token = data['token'];
        this.socket = io();
        this.socket.on('connect', () => {
          this.socket.emit('login', this.token);
        });

        // login
        this.socket.on('login_success', function(sucess: boolean) {
          console.log('connected', sucess);
        })
        // Panic Events
          .on('panic', (event) => {
            console.log(event);
            console.log('panic event');
            if (event.classroom === this.currentClassroomId) {
              this.panicNumbers[event.classroom] = event.panicNumber;
              this.UpdatePanicView();
            }
          })
          .on('panic_state_change', (event) => {
            this.panicStates[event.classroom] = event.state;
            console.log('state change');
            if (event.classroom === this.currentClassroomId) {
              this.UpdatePanicView();
            }
          })
          .on('refresh', (event) => {
            // set values
            console.log('refresh:', event);
            if (event.classroom === this.currentClassroomId) {
              this.UpdatePanicView();
            }
          })
          .on('new_question', (event) => {
            console.log('new_question:', event);
            console.log('Local number of questions:', this.classroom.questions.length);
            console.log('Event number of questions:', event.numberOfQuestions);
            if ((event.classroom === this.currentClassroomId) &&
                (this.classroom.questions.length !== event.numberOfQuestions)) {
              this.GetClassroomObject();
            }
          })
          .on('question_vote', (event) => {
            console.log('question_vote', event);
            if (event.classroom === this.currentClassroomId) {
              this.GetClassroomObject();
            }
          })
          .on('answer_vote', (event) => {
            console.log('answer_vote', event);
            if (event.classroom === this.currentClassroomId) {
              this.GetClassroomObject();
            }
          })
          .on('new_answer', (event) => {
            console.log('new_answer', event);
            if (event.classroom === this.currentClassroomId) {
              this.GetClassroomObject();
            }
          })
          .on('topic_change', (event) => {
            console.log('topic_change', event);
            if (event.classroom === this.currentClassroomId) {
              console.log('Changing topic to', event.topic);
              this.setTopicInfo(event.topic, event.first, event.last);
            }
          });
      });

      // set a continous 3 second run of chart updater
      setInterval(() => this.ChangeData(), 6 * 1000);
  }

  Panic() {
    this.socket.emit('panic', { classroom: this.currentClassroomId, state: !this.panicStates[this.currentClassroomId] });
    console.log('button hit');
  }

  NewQuestion() {
    const url = `/api/v1/classrooms/${this.currentClassroomId}/questions`;
    if (!this.isQuestionAsked && this.newQuestion !== '') {
      this.HTTP.post(url, {question: this.newQuestion})
        .subscribe((data) => { });
      this.isQuestionAsked = !this.isQuestionAsked;
      this.newQuestion = '';
    } else {
      this.isQuestionAsked = !this.isQuestionAsked;
      this.newQuestion = '';
    }
  }

  UpdatePanicView() {
    this.isPanic = this.panicStates[this.currentClassroomId];
    this.numberPanic = this.panicNumbers[this.currentClassroomId];
    this.percentPanicked = Math.round(this.numberPanic * 100 / this.studentCount);
  }

  ToggleChart() {
    this.showChart = !this.showChart;
  }

  GetClassroomObject() {
    this.HTTP.get<Classroom>(`/api/v1/classrooms/${this.currentClassroomId}`)
    .subscribe((classroom) => {
        this.classroom = classroom;
        console.log('classroom', this.classroom);
        this.classroom.studentCount = this.classroom.students.length;
        this.studentCount = this.classroom.students.length;
        console.log(this.classroom.questions);
        this.setClassInfo();
        this.setTopicInfo(this.classroom.topics[this.classroom.currentTopic],
          this.classroom.currentTopic === 0,
          this.classroom.currentTopic === (this.classroom.topics.length - 1));
        this.addNewQuestionsToViewLogic();
     });
  }

  UpdateQuestionsView(numberOfQuestions: number) {
    if (this.classroom.questions.length !== numberOfQuestions) {
      this.GetClassroomObject();
    }
  }

  ReplyToQuestion(questionId: string) {
    const url = `/api/v1/classrooms/${this.currentClassroomId}/question/${questionId}/answers`;
    console.log(url);
    console.log(this.questionAnswers);
    if (this.questionAnswers[questionId] !== '') {
      this.HTTP.post(url, {answer: this.questionAnswers[questionId]})
      .subscribe((data) => {
        this.questionAnswers[questionId] = '';
        this.showAnswers[questionId] = true;
      });
    }
  }

  ReplyToAnswer(): void {
    const url = `/api/v1/classrooms/${this.currentClassroomId}/questions/${this.replyQuestionId}/answers`;
    this.replyMode = false;
    if (this.questionAnswer !== '') {
      this.HTTP.post(url, {answer: this.questionAnswer})
      .subscribe((data) => { this.questionAnswer = ''; });
    }
  }

  VoteForQuestion(qId: string, up: boolean) {
    console.log(qId);
    const url = `/api/v1/classrooms/${this.currentClassroomId}/questions/${qId}`;
    this.HTTP.put<SuccessResponse>(url, { up })
      .subscribe((response) => { console.log('Voted up:', up); });
  }

  VoteForAnswer(qId: string, aId: string, up: boolean) {
    console.log(qId);
    console.log(aId);
    const url = `/api/v1/classrooms/${this.currentClassroomId}/questions/${qId}/answers/${aId}`;
    this.HTTP.put<SuccessResponse>(url, { up })
      .subscribe((response) => { console.log('Voted up:', up); });
  }

  NextTopic(): void {
    this.socket.emit('topic_change', {
      classroom: this.currentClassroomId,
      next: true,
      previous: false,
    });
  }

  PreviousTopic(): void {
    this.socket.emit('topic_change', {
      classroom: this.currentClassroomId,
      next: false,
      previous: true,
    });
  }

  getCSS() {
    const percentPanicked = this.numberPanic / this.classroom.students.length;
    if (percentPanicked < 0.33) {
      return 'green';
    } else if (percentPanicked > 0.33 && percentPanicked < 0.66) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  setClassInfo(): void {
    // based on {{classroom.courseNumber}} - {{classroom.courseTitle}}
    if (this.classroom.courseType && this.classroom.courseNumber) {
        this.courseInfo = `${this.classroom.courseType} ${this.classroom.courseNumber}`;
    } else {
      this.courseInfo = '';
    }
  }

  setTopicInfo(topic: string, first: boolean, last: boolean): void {
    if (topic.length > 48) {
      this.currentTopic = `${topic.slice(0, 44)}...`;
    } else {
      this.currentTopic = topic;
    }
    this.firstTopic = first;
    this.lastTopic = last;
  }

  addNewQuestionsToViewLogic(): void {
    if (this.showAnswers === null || this.showAnswers === undefined) {
      this.showAnswers = {} as ShowAnswerMap;
    }

    this.classroom.questions.forEach((q) => {
      if (!this.showAnswers[q._id]) {
        this.showAnswers[q._id] = false;
      }
    });
  }

  setAnswersViewableFor(qId: string, viewable: boolean): void {
    this.showAnswers[qId] = viewable;
  }

  // Chart Stuff
  ChangeData() {
    const dataArr = [this.percentPanicked];
    const date = new Date();
    const time = `${date.getHours().toString()}:${date.getMinutes().toString()}:${date.getSeconds().toString()}`;

    this.chartData.forEach((dataset, index) => {
      this.chartData[index] = Object.assign({}, this.chartData[index], {
        data: [...this.chartData[index].data, dataArr[index]]
      });
    });

    if (!this.chartLabels) {
      this.chartLabels = [time];
    } else if (this.chartLabels.length >= 10) {
      this.chartLabels = [...this.chartLabels.slice(-9), time];
    } else {
      this.chartLabels = [...this.chartLabels, time];
    }

    console.log(time);
  }


  onChartClick(event) {
    console.log(event);
  }

}

export interface Classroom {
  _id: string;
  courseNumber: string;
  courseTitle: string;
  role: string;
  courseType: string;
  sectionNumber: string;
  studentCount: number;
  studentCode: string;
  teacherCode: string;
  questions: [Question];
  students: [string];
  teachers: [string];
  teacherAssistants: [string];
  topics: [string];
  currentTopic: number;
  schoolId: string;
  schoolName: string;
}

export interface QuestionAnswers {
  [_id: string]: string;
}

export interface ShowAnswerMap {
  [_id: string]: boolean;
}

export interface Question {
  _id: string;
  question: string;
  ts: number;
  answers: [Answer];
  votes: [string];
  resolution: number;
  mine: boolean;
  isTeacher: boolean;
}

export interface Answer {
  _id: string;
  answer: string;
  votes: [string];
  ts: number;
  mine: boolean;
  isTeacher: boolean;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ChartData {
  data: [number];
  label: string;
}

export interface LineChartOptions {
  responsive: boolean;
}

export interface DonutChartOptions {
  cutoutPercentage: number;
}
