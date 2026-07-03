import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';
import {
  Chart,
  ChartData,
  ChartOptions,
  registerables,
} from 'chart.js';

// Register all Chart.js components once at module load time.
Chart.register(...registerables);

@Component({
  selector: 'app-bar-chart',
  imports: [],
  template: `<canvas #canvas></canvas>`,
  styles: [':host { display: block; width: 100%; height: 100%; }'],
})
export class BarChart implements AfterViewInit, OnDestroy {
  readonly data    = input.required<ChartData<'bar'>>();
  readonly options = input<ChartOptions<'bar'>>({});

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart<'bar'>;

  ngAfterViewInit(): void {
    const ctx = this.canvas().nativeElement.getContext('2d')!;
    this.chart = new Chart<'bar'>(ctx, {
      type: 'bar',
      data: this.data(),
      options: this.options(),
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
