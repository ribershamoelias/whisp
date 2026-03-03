import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:whisp_mobile/core/app.dart';

void main() {
  testWidgets('renders scaffold home', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: WhispApp()));
    expect(find.text('WHISP Phase 1 Scaffold'), findsOneWidget);
  });
}
